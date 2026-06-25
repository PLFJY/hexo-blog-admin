import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { EditorView } from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import type { PreviewSyncPosition } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { buildApiUrl } from "../lib/apiClient";
import type { ResolvedMarkdownResourceUrl } from "../lib/markdownResource";
import type { DraftAsset } from "../shared/assetTypes";

const SINGLE_COLUMN_MEDIA_QUERY = "(max-width: 960px)";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    [`@media ${SINGLE_COLUMN_MEDIA_QUERY}`]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  column: {
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  previewColumn: {
    paddingTop: `calc(32px + ${tokens.spacingVerticalXS})`,
    [`@media ${SINGLE_COLUMN_MEDIA_QUERY}`]: {
      paddingTop: 0,
    },
  },
});

/**
 * Markdown 编辑器 / 预览区滚动同步调参区。
 *
 * 参数分成 7 组：
 * 1. active source：判断当前是谁在主动滚动。
 * 2. editor -> preview 实时跟随：用户滚编辑器时，预览如何跟着动。
 * 3. 补偿动画：非实时滚动的大跨度跳转如何变平滑。
 * 4. editor 到底识别：编辑器到底时，预览必须到底。
 * 5. 光标 reveal：光标移动后，预览是否主动对齐到光标位置。
 * 6. preview -> editor：用户滚预览时，编辑器如何反向跟随。
 * 7. PreviewLineMap 重建：预览 DOM 高度变化后，何时重建映射表。
 */
const SYNC_TUNING = {
  // ---------------------------------------------------------------------------
  // 1. 主动滚动源控制
  // ---------------------------------------------------------------------------

  /**
   * 用户停止滚动后，active source 保持多久。
   *
   * 调大：慢速滚动更稳定，但双向切换稍慢。
   * 调小：双向切换更灵敏，但慢速滚动可能断续。
   *
   * 推荐范围：600 ~ 1000
   */
  scrollSourceReleaseDelay: 800,

  /**
   * 普通程序性 scrollTop 设置的忽略阈值。
   *
   * 这是“普通瞬时设置”的阈值，不是实时跟随阈值。
   * 实时跟随用 liveScrollEpsilon。
   *
   * 推荐范围：1 ~ 3
   */
  programmaticScrollEpsilon: 2,

  // ---------------------------------------------------------------------------
  // 2. editor -> preview 实时跟随
  // ---------------------------------------------------------------------------

  /**
   * 是否启用 editor -> preview 的 rAF 微平滑。
   *
   * 开启后，预览不会每次硬跳到目标位置，而是在 1~3 帧内快速追上。
   */
  liveFollowEnabled: true,

  /**
   * 实时跟随每帧向目标靠近的比例。
   *
   * 越高：越跟手，但越接近硬跳。
   * 越低：越丝滑，但预览可能慢半拍。
   *
   * 推荐：0.62 更柔，0.72 均衡，0.82 更跟手。
   * 推荐范围：0.6 ~ 0.85
   */
  liveFollowSmoothing: 0.72,

  /**
   * 实时跟随距离目标小于多少 px 时直接贴合。
   *
   * 推荐范围：0.5 ~ 2
   */
  liveFollowSnapDistance: 1,

  /**
   * 实时跟随专用忽略阈值。
   *
   * 这个值应该比 programmaticScrollEpsilon 小，否则小幅滚动会有颗粒感。
   *
   * 推荐范围：0.25 ~ 1
   */
  liveScrollEpsilon: 0.5,

  /**
   * editor -> preview 的语义同步权重。
   *
   * semantic target：根据源码行和预览 DOM anchor 对齐。
   * ratio target：根据 editor / preview 全局滚动比例对齐。
   *
   * 越高：越准，但更容易有锚点感。
   * 越低：越顺，但可能略偏。
   *
   * 推荐范围：0.65 ~ 0.85
   */
  editorToPreviewSemanticWeight: 0.75,

  /**
   * editor 顶部源码行取样点。
   *
   * 不直接取视口最顶部，而是向下偏移一点，避免卡在半行边界时抖动。
   *
   * 推荐范围：12 ~ 24
   */
  editorScrollAnchorYOffset: 16,

  // ---------------------------------------------------------------------------
  // 3. 大跨度补偿动画
  // ---------------------------------------------------------------------------

  /**
   * 补偿动画的最小触发距离。
   *
   * 小于这个距离时，直接设置，避免小误差也一直滑动。
   *
   * 推荐范围：16 ~ 40
   */
  correctionMinDistance: 20,

  /**
   * 补偿动画基础时长。
   *
   * 推荐范围：100 ~ 160
   */
  correctionBaseDuration: 130,

  /**
   * 补偿动画最长时长。
   *
   * 大跨度过渡是否明显，主要看这个参数和 correctionDistanceFactor。
   *
   * 推荐范围：260 ~ 460
   */
  correctionMaxDuration: 360,

  /**
   * 距离对补偿动画时长的影响。
   *
   * duration = correctionBaseDuration + distance * correctionDistanceFactor，
   * 然后被 correctionMaxDuration 截断。
   *
   * 推荐范围：0.10 ~ 0.24
   */
  correctionDistanceFactor: 0.18,

  // ---------------------------------------------------------------------------
  // 4. editor 到底识别 + preview 独立贴底控制器
  // ---------------------------------------------------------------------------

  /**
   * editor 距离底部多少 px 内，就认为已经到底。
   *
   * 如果 editor 明明到底但 preview 没到底：调大。
   * 如果 preview 太早被吸到底：调小。
   *
   * 推荐范围：48 ~ 96
   */
  editorBottomStickEpsilon: 72,

  /**
   * editor 滚动比例达到多少，就认为接近底部。
   *
   * 如果某些文章底部仍然识别不到：调低，例如 0.99。
   * 如果 preview 太早到底：调高，例如 0.995。
   *
   * 推荐范围：0.99 ~ 0.998
   */
  editorBottomStickRatio: 0.992,

  /**
   * 判断 editor 底部可见行时，距离视口底部向上偏移多少 px。
   *
   * 推荐范围：12 ~ 24
   */
  editorBottomAnchorYOffset: 16,

  /**
   * editor 到底后，preview 是否使用独立贴底动画。
   *
   * 这是独立 bottom-stick controller，不再复用普通 correction animation。
   */
  bottomStickSmoothEnabled: true,

  /**
   * preview 独立贴底动画时长。
   *
   * 如果贴底动画不明显：调大到 500。
   * 如果贴底太慢：调小到 180 ~ 260。
   *
   * 推荐范围：180 ~ 500
   */
  bottomStickSmoothDuration: 400,

  /**
   * preview 贴底动画距离目标小于多少 px 时直接吸附到底。
   *
   * 推荐范围：0.5 ~ 4
   */
  bottomStickSnapDistance: 1,

  /**
   * preview 距离底部小于这个值时，认为已经贴底。
   *
   * 推荐范围：1 ~ 8
   */
  previewBottomEpsilon: 2,

  // ---------------------------------------------------------------------------
  // 5. 光标 reveal
  // ---------------------------------------------------------------------------

  /**
   * 光标移动后，把目标行放在 preview 视口的哪个高度位置。
   *
   * 0.00：目标行贴近顶部。
   * 0.18：推荐默认，比较克制。
   * 0.50：目标行居中，但跳动跨度会更大。
   *
   * 推荐范围：0.12 ~ 0.30
   */
  cursorRevealRatio: 0.18,

  /**
   * 光标 reveal 的动画时长。
   *
   * 推荐范围：100 ~ 220
   */
  cursorRevealSmoothDuration: 150,

  // ---------------------------------------------------------------------------
  // 6. preview -> editor 反向同步
  // ---------------------------------------------------------------------------

  /**
   * preview -> editor 滚动中只做比例轻量跟随。
   * 停下来后等待这个时间，再用源码行做一次校准。
   *
   * 推荐范围：300 ~ 700
   */
  previewToEditorSettleDelay: 450,

  // ---------------------------------------------------------------------------
  // 7. PreviewLineMap 重建
  // ---------------------------------------------------------------------------

  /**
   * PreviewLineMap 延迟重建时间。
   *
   * 图片加载、Mermaid 渲染、预览尺寸变化后会标记 dirty，
   * 但不应该立刻抢滚动帧重建。
   *
   * 推荐范围：120 ~ 300
   */
  scrollMapRebuildDelay: 180,

  /**
   * 用户 pointer 仍停在 editor / preview 上时，是否推迟 PreviewLineMap 重建。
   *
   * 一般保持 true。
   */
  deferRebuildWhilePointerInside: true,
} as const;

type PreviewLineMap = {
  lines: number[];
  previewYs: number[];
  previewMaxScrollTop: number;
};

type ScrollSource = "editor" | "preview" | null;

type SourceAnchor = {
  line: number;
  previewY: number;
};

type ArticleMarkdownWorkspaceProps = {
  markdown: string;
  onChange: (markdown: string) => void;
  resolveResourceUrl?: (src: string) => ResolvedMarkdownResourceUrl;
  assets?: DraftAsset[];
  onAssetObjectUrlsChange?: (urls: Record<string, string>) => void;
  insertRequest?: { id: number; text: string };
  onInsertConsumed?: (id: number) => void;
  onPasteImages?: (files: File[]) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const mapByGlobalRatio = (
  sourceScrollTop: number,
  sourceMax: number,
  targetMax: number,
) => {
  if (sourceMax <= 0) return 0;
  return targetMax * (sourceScrollTop / sourceMax);
};

const getPreviewY = (previewRoot: HTMLElement, element: HTMLElement) => {
  if (element.offsetParent === previewRoot) return element.offsetTop;

  const rootRect = previewRoot.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return elementRect.top - rootRect.top + previewRoot.scrollTop;
};

const buildPreviewLineMap = (
  view: EditorView,
  previewRoot: HTMLElement,
): PreviewLineMap => {
  const previewMaxScrollTop = Math.max(
    0,
    previewRoot.scrollHeight - previewRoot.clientHeight,
  );
  const anchorByLine = new Map<number, number>([[1, 0]]);
  const addAnchor = (line: number, previewY: number, mode: "min" | "max") => {
    const safeLine = Math.min(
      view.state.doc.lines,
      Math.max(1, Math.floor(line)),
    );
    const safePreviewY = clamp(previewY, 0, previewMaxScrollTop);
    const current = anchorByLine.get(safeLine);
    if (current == null) {
      anchorByLine.set(safeLine, safePreviewY);
      return;
    }

    anchorByLine.set(
      safeLine,
      mode === "min"
        ? Math.min(current, safePreviewY)
        : Math.max(current, safePreviewY),
    );
  };

  const previewAnchors = Array.from(
    previewRoot.querySelectorAll<HTMLElement>("[data-source-line]"),
  )
    .map((element) => ({
      element,
      startLine: Number(element.dataset.sourceLine),
      endLine: Number(element.dataset.sourceEndLine),
    }))
    .filter(
      (anchor) => Number.isFinite(anchor.startLine) && anchor.startLine >= 1,
    )
    .sort((a, b) => a.startLine - b.startLine);

  for (const anchor of previewAnchors) {
    const previewY = getPreviewY(previewRoot, anchor.element);
    if (!Number.isFinite(previewY)) continue;

    const startLine = Math.min(
      view.state.doc.lines,
      Math.max(1, Math.floor(anchor.startLine)),
    );
    const endLine = Number.isFinite(anchor.endLine)
      ? Math.min(
          view.state.doc.lines,
          Math.max(startLine, Math.floor(anchor.endLine)),
        )
      : startLine;

    addAnchor(startLine, previewY, "min");

    if (endLine > startLine) {
      const rectHeight = anchor.element.getBoundingClientRect().height;
      const elementHeight =
        Number.isFinite(rectHeight) && rectHeight > 0
          ? rectHeight
          : anchor.element.offsetHeight;
      addAnchor(endLine, previewY + elementHeight, "max");
    }
  }

  const anchors = Array.from(anchorByLine.entries()).map(
    ([line, previewY]) => ({ line, previewY }),
  );
  anchors.sort((a, b) => a.line - b.line);

  const normalized: SourceAnchor[] = [];
  for (const anchor of anchors) {
    const previous = normalized[normalized.length - 1];
    if (previous && anchor.previewY < previous.previewY) continue;
    normalized.push(anchor);
  }

  const bottomAnchor: SourceAnchor = {
    line: view.state.doc.lines,
    previewY: previewMaxScrollTop,
  };

  const last = normalized[normalized.length - 1];
  if (!last) normalized.push(bottomAnchor);
  else if (last.line === bottomAnchor.line)
    normalized[normalized.length - 1] = bottomAnchor;
  else normalized.push(bottomAnchor);

  return {
    lines: normalized.map((anchor) => anchor.line),
    previewYs: normalized.map((anchor) => anchor.previewY),
    previewMaxScrollTop,
  };
};

const mapSourceLineToPreviewY = (line: number, lineMap: PreviewLineMap) => {
  const { lines, previewYs } = lineMap;
  if (lines.length === 0 || lines.length !== previewYs.length) return undefined;
  if (line <= lines[0]) return previewYs[0];
  if (line >= lines[lines.length - 1]) return previewYs[previewYs.length - 1];

  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid] > line) high = mid;
    else low = mid + 1;
  }

  const index = low;
  const lineStart = lines[index - 1];
  const lineEnd = lines[index];
  const yStart = previewYs[index - 1];
  const yEnd = previewYs[index];
  if (lineEnd === lineStart) return yStart;

  const progress = (line - lineStart) / (lineEnd - lineStart);
  return yStart + progress * (yEnd - yStart);
};

const getPreviewRangeForSourceLine = (
  previewRoot: HTMLElement,
  line: number,
) => {
  const candidates = Array.from(
    previewRoot.querySelectorAll<HTMLElement>("[data-source-line]"),
  )
    .map((element) => {
      const startLine = Number(element.dataset.sourceLine);
      const endLine = Number(element.dataset.sourceEndLine);
      if (!Number.isFinite(startLine)) return undefined;

      const safeEndLine = Number.isFinite(endLine)
        ? Math.max(startLine, endLine)
        : startLine;

      return {
        element,
        startLine,
        endLine: safeEndLine,
      };
    })
    .filter(Boolean) as Array<{
    element: HTMLElement;
    startLine: number;
    endLine: number;
  }>;

  const containing = candidates
    .filter(
      (candidate) =>
        candidate.startLine <= line && candidate.endLine >= line,
    )
    .sort((a, b) => {
      const aSpan = a.endLine - a.startLine;
      const bSpan = b.endLine - b.startLine;
      return aSpan - bSpan || b.startLine - a.startLine;
    })[0];

  if (containing) {
    const top = getPreviewY(previewRoot, containing.element);
    const height =
      containing.element.getBoundingClientRect().height ||
      containing.element.offsetHeight ||
      0;

    return {
      top,
      bottom: top + height,
      y: line >= containing.endLine ? top + height : top,
    };
  }

  const previous = candidates
    .filter((candidate) => candidate.endLine < line)
    .sort((a, b) => b.endLine - a.endLine)[0];

  const next = candidates
    .filter((candidate) => candidate.startLine > line)
    .sort((a, b) => a.startLine - b.startLine)[0];

  if (next) {
    const top = getPreviewY(previewRoot, next.element);
    return { top, bottom: top, y: top };
  }

  if (previous) {
    const top = getPreviewY(previewRoot, previous.element);
    const height =
      previous.element.getBoundingClientRect().height ||
      previous.element.offsetHeight ||
      0;

    return { top, bottom: top + height, y: top + height };
  }

  return undefined;
};

const mapPreviewYToSourceLine = (previewY: number, lineMap: PreviewLineMap) => {
  const { lines, previewYs } = lineMap;
  if (lines.length === 0 || lines.length !== previewYs.length) return undefined;
  if (previewY <= previewYs[0]) return lines[0];
  if (previewY >= previewYs[previewYs.length - 1])
    return lines[lines.length - 1];

  let low = 0;
  let high = previewYs.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (previewYs[mid] > previewY) high = mid;
    else low = mid + 1;
  }

  const index = low;
  const yStart = previewYs[index - 1];
  const yEnd = previewYs[index];
  const lineStart = lines[index - 1];
  const lineEnd = lines[index];

  if (yEnd === yStart) return lineStart;

  const progress = (previewY - yStart) / (yEnd - yStart);
  return Math.round(lineStart + progress * (lineEnd - lineStart));
};

const getEditorTopVisibleLine = (view: EditorView) => {
  const rect = view.scrollDOM.getBoundingClientRect();
  const anchorYInViewport = SYNC_TUNING.editorScrollAnchorYOffset;
  const pos = view.posAtCoords({
    x: rect.left + SYNC_TUNING.editorScrollAnchorYOffset,
    y: rect.top + anchorYInViewport,
  });

  if (pos == null) {
    return view.state.doc.lineAt(view.state.selection.main.head).number;
  }

  const line = view.state.doc.lineAt(pos);
  const block = view.lineBlockAt(pos);
  const anchorYInDocument = view.scrollDOM.scrollTop + anchorYInViewport;

  const progress =
    block.height > 0
      ? clamp((anchorYInDocument - block.top) / block.height, 0, 0.999)
      : 0;

  return line.number + progress;
};

const getEditorBottomVisibleLine = (view: EditorView) => {
  const rect = view.scrollDOM.getBoundingClientRect();
  const pos = view.posAtCoords({
    x: rect.left + SYNC_TUNING.editorScrollAnchorYOffset,
    y: rect.bottom - SYNC_TUNING.editorBottomAnchorYOffset,
  });

  if (pos == null) {
    return view.state.doc.lineAt(view.state.selection.main.head).number;
  }

  return view.state.doc.lineAt(pos).number;
};

const isEditorAtBottom = (view: EditorView) => {
  const scrollDom = view.scrollDOM;
  const editorMaxScrollTop = Math.max(
    0,
    scrollDom.scrollHeight - scrollDom.clientHeight,
  );
  if (editorMaxScrollTop <= 0) return true;

  const distanceToBottom = editorMaxScrollTop - scrollDom.scrollTop;
  if (distanceToBottom <= SYNC_TUNING.editorBottomStickEpsilon) return true;

  const ratio = scrollDom.scrollTop / editorMaxScrollTop;
  if (ratio >= SYNC_TUNING.editorBottomStickRatio) return true;

  const bottomVisibleLine = getEditorBottomVisibleLine(view);
  return bottomVisibleLine >= view.state.doc.lines;
};

const scrollEditorToLine = (view: EditorView, lineNumber: number) => {
  const safeLine = Math.max(
    1,
    Math.min(view.state.doc.lines, Math.round(lineNumber)),
  );
  const line = view.state.doc.line(safeLine);

  view.dispatch({
    effects: EditorView.scrollIntoView(line.from, {
      y: "start",
      yMargin: SYNC_TUNING.editorScrollAnchorYOffset,
    }),
  });
};

export function ArticleMarkdownWorkspace({
  markdown,
  onChange,
  resolveResourceUrl,
  assets = [],
  onAssetObjectUrlsChange,
  insertRequest,
  onInsertConsumed,
  onPasteImages,
}: ArticleMarkdownWorkspaceProps) {
  const styles = useStyles();
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [previewRoot, setPreviewRoot] = useState<HTMLDivElement | null>(null);

  const onAssetObjectUrlsChangeRef = useRef(onAssetObjectUrlsChange);
  const editorViewRef = useRef<EditorView | null>(null);
  const previewRootRef = useRef<HTMLDivElement | null>(null);

  const scrollMapRef = useRef<PreviewLineMap | undefined>(undefined);
  const scrollMapDirtyRef = useRef(true);
  const scrollMapRebuildTimerRef = useRef<number | undefined>(undefined);

  const activeScrollSourceRef = useRef<ScrollSource>(null);
  const pointerAreaRef = useRef<ScrollSource>(null);

  const suppressEditorScrollRef = useRef(false);
  const suppressPreviewScrollRef = useRef(false);
  const editorSuppressTokenRef = useRef(0);
  const previewSuppressTokenRef = useRef(0);

  const scrollSourceReleaseTimerRef = useRef<number | undefined>(undefined);
  const editorToPreviewFrameRef = useRef<number | undefined>(undefined);
  const previewToEditorFrameRef = useRef<number | undefined>(undefined);
  const previewSettleTimerRef = useRef<number | undefined>(undefined);
  const cursorSyncFrameRef = useRef<number | undefined>(undefined);

  const previewLiveFollowFrameRef = useRef<number | undefined>(undefined);
  const previewLiveFollowTargetRef = useRef<number | undefined>(undefined);
  const previewCorrectionFrameRef = useRef<number | undefined>(undefined);
  const previewCorrectionAnimationRef = useRef<
    | {
        start: number;
        from: number;
        to: number;
        duration: number;
      }
    | undefined
  >(undefined);
  const previewBottomStickFrameRef = useRef<number | undefined>(undefined);
  const previewBottomStickAnimationRef = useRef<
    | {
        start: number;
        from: number;
        duration: number;
      }
    | undefined
  >(undefined);
  const previewBottomStickTargetRef = useRef<number | undefined>(undefined);
  const previewBottomStickActiveRef = useRef(false);

  const latestCursorLineRef = useRef(1);
  const pendingCursorLineRef = useRef<number | undefined>(undefined);

  const releasePreviewSuppressLater = useCallback((token: number) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (previewSuppressTokenRef.current === token) {
          suppressPreviewScrollRef.current = false;
        }
      });
    });
  }, []);

  const releaseEditorSuppressLater = useCallback((token: number) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (editorSuppressTokenRef.current === token) {
          suppressEditorScrollRef.current = false;
        }
      });
    });
  }, []);

  const cancelPreviewLiveFollowAnimation = useCallback(() => {
    if (previewLiveFollowFrameRef.current !== undefined) {
      window.cancelAnimationFrame(previewLiveFollowFrameRef.current);
      previewLiveFollowFrameRef.current = undefined;
    }
    previewLiveFollowTargetRef.current = undefined;
  }, []);

  const cancelPreviewCorrectionAnimation = useCallback(() => {
    if (previewCorrectionFrameRef.current !== undefined) {
      window.cancelAnimationFrame(previewCorrectionFrameRef.current);
      previewCorrectionFrameRef.current = undefined;
    }
    previewCorrectionAnimationRef.current = undefined;
  }, []);

  const cancelPreviewBottomStickAnimation = useCallback(
    (snapToBottom = false) => {
      if (previewBottomStickFrameRef.current !== undefined) {
        window.cancelAnimationFrame(previewBottomStickFrameRef.current);
        previewBottomStickFrameRef.current = undefined;
      }

      previewBottomStickAnimationRef.current = undefined;
      previewBottomStickTargetRef.current = undefined;
      previewBottomStickActiveRef.current = false;

      if (!snapToBottom) return;

      const root = previewRootRef.current;
      if (!root) return;

      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
      const token = previewSuppressTokenRef.current + 1;
      previewSuppressTokenRef.current = token;
      suppressPreviewScrollRef.current = true;
      root.scrollTop = maxScrollTop;
      releasePreviewSuppressLater(token);
    },
    [releasePreviewSuppressLater],
  );

  const cancelPreviewScrollAnimation = useCallback(() => {
    cancelPreviewLiveFollowAnimation();
    cancelPreviewCorrectionAnimation();
    cancelPreviewBottomStickAnimation(false);
  }, [
    cancelPreviewBottomStickAnimation,
    cancelPreviewCorrectionAnimation,
    cancelPreviewLiveFollowAnimation,
  ]);

  const getCorrectionDuration = useCallback(
    (distance: number, preferredDuration?: number) => {
      if (preferredDuration !== undefined) return preferredDuration;

      return clamp(
        SYNC_TUNING.correctionBaseDuration +
          distance * SYNC_TUNING.correctionDistanceFactor,
        SYNC_TUNING.correctionBaseDuration,
        SYNC_TUNING.correctionMaxDuration,
      );
    },
    [],
  );

  const setPreviewScrollTopProgrammatically = useCallback(
    (target: number) => {
      const root = previewRootRef.current;
      if (!root) return;

      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
      const next = clamp(target, 0, maxScrollTop);
      if (
        Math.abs(root.scrollTop - next) < SYNC_TUNING.programmaticScrollEpsilon
      )
        return;

      const token = previewSuppressTokenRef.current + 1;
      previewSuppressTokenRef.current = token;
      suppressPreviewScrollRef.current = true;
      root.scrollTop = next;
      releasePreviewSuppressLater(token);
    },
    [releasePreviewSuppressLater],
  );

  const setPreviewScrollTopLive = useCallback(
    (target: number) => {
      const root = previewRootRef.current;
      if (!root) return;

      cancelPreviewBottomStickAnimation(false);

      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
      const nextTarget = clamp(target, 0, maxScrollTop);

      if (!SYNC_TUNING.liveFollowEnabled) {
        setPreviewScrollTopProgrammatically(nextTarget);
        return;
      }

      if (Math.abs(root.scrollTop - nextTarget) < SYNC_TUNING.liveScrollEpsilon)
        return;

      previewLiveFollowTargetRef.current = nextTarget;
      if (previewLiveFollowFrameRef.current !== undefined) return;

      const run = () => {
        const currentRoot = previewRootRef.current;
        const target = previewLiveFollowTargetRef.current;

        if (!currentRoot || target === undefined) {
          previewLiveFollowFrameRef.current = undefined;
          return;
        }

        const maxScrollTop = Math.max(
          0,
          currentRoot.scrollHeight - currentRoot.clientHeight,
        );
        const safeTarget = clamp(target, 0, maxScrollTop);
        const distance = safeTarget - currentRoot.scrollTop;

        const token = previewSuppressTokenRef.current + 1;
        previewSuppressTokenRef.current = token;
        suppressPreviewScrollRef.current = true;

        if (Math.abs(distance) <= SYNC_TUNING.liveFollowSnapDistance) {
          currentRoot.scrollTop = safeTarget;
          previewLiveFollowTargetRef.current = undefined;
          previewLiveFollowFrameRef.current = undefined;
          releasePreviewSuppressLater(token);
          return;
        }

        currentRoot.scrollTop += distance * SYNC_TUNING.liveFollowSmoothing;
        releasePreviewSuppressLater(token);
        previewLiveFollowFrameRef.current = window.requestAnimationFrame(run);
      };

      previewLiveFollowFrameRef.current = window.requestAnimationFrame(run);
    },
    [
      cancelPreviewBottomStickAnimation,
      releasePreviewSuppressLater,
      setPreviewScrollTopProgrammatically,
    ],
  );

  const setPreviewScrollTopWithCorrection = useCallback(
    (target: number, preferredDuration?: number) => {
      const root = previewRootRef.current;
      if (!root) return;

      cancelPreviewBottomStickAnimation(false);
      cancelPreviewLiveFollowAnimation();

      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
      const safeTarget = clamp(target, 0, maxScrollTop);
      const distance = Math.abs(safeTarget - root.scrollTop);

      if (distance < SYNC_TUNING.correctionMinDistance) {
        setPreviewScrollTopProgrammatically(safeTarget);
        return;
      }

      cancelPreviewCorrectionAnimation();

      const start = performance.now();
      const duration = getCorrectionDuration(distance, preferredDuration);

      previewCorrectionAnimationRef.current = {
        start,
        from: root.scrollTop,
        to: safeTarget,
        duration,
      };

      const run = (now: number) => {
        const currentRoot = previewRootRef.current;
        const animation = previewCorrectionAnimationRef.current;

        if (!currentRoot || !animation) {
          previewCorrectionFrameRef.current = undefined;
          return;
        }

        const progress = clamp(
          (now - animation.start) / animation.duration,
          0,
          1,
        );
        const eased = easeOutCubic(progress);
        const next = animation.from + (animation.to - animation.from) * eased;
        const token = previewSuppressTokenRef.current + 1;

        previewSuppressTokenRef.current = token;
        suppressPreviewScrollRef.current = true;
        currentRoot.scrollTop = next;

        if (progress >= 1) {
          currentRoot.scrollTop = animation.to;
          previewCorrectionAnimationRef.current = undefined;
          previewCorrectionFrameRef.current = undefined;
          releasePreviewSuppressLater(token);
          return;
        }

        releasePreviewSuppressLater(token);
        previewCorrectionFrameRef.current = window.requestAnimationFrame(run);
      };

      previewCorrectionFrameRef.current = window.requestAnimationFrame(run);
    },
    [
      cancelPreviewBottomStickAnimation,
      cancelPreviewCorrectionAnimation,
      cancelPreviewLiveFollowAnimation,
      getCorrectionDuration,
      releasePreviewSuppressLater,
      setPreviewScrollTopProgrammatically,
    ],
  );

  const startPreviewBottomStick = useCallback(() => {
    const root = previewRootRef.current;
    if (!root) return;

    const target = Math.max(0, root.scrollHeight - root.clientHeight);
    previewBottomStickTargetRef.current = target;
    previewBottomStickActiveRef.current = true;

    cancelPreviewLiveFollowAnimation();
    cancelPreviewCorrectionAnimation();

    if (!SYNC_TUNING.bottomStickSmoothEnabled) {
      const token = previewSuppressTokenRef.current + 1;
      previewSuppressTokenRef.current = token;
      suppressPreviewScrollRef.current = true;
      root.scrollTop = target;
      releasePreviewSuppressLater(token);
      cancelPreviewBottomStickAnimation(false);
      return;
    }

    const distance = Math.abs(target - root.scrollTop);
    if (distance <= SYNC_TUNING.bottomStickSnapDistance) {
      const token = previewSuppressTokenRef.current + 1;
      previewSuppressTokenRef.current = token;
      suppressPreviewScrollRef.current = true;
      root.scrollTop = target;
      releasePreviewSuppressLater(token);
      cancelPreviewBottomStickAnimation(false);
      return;
    }

    // 如果贴底动画已经在跑，只更新目标，不重启动画。
    if (previewBottomStickFrameRef.current !== undefined) return;

    previewBottomStickAnimationRef.current = {
      start: performance.now(),
      from: root.scrollTop,
      duration: SYNC_TUNING.bottomStickSmoothDuration,
    };

    const run = (now: number) => {
      const currentRoot = previewRootRef.current;
      const animation = previewBottomStickAnimationRef.current;

      if (!currentRoot || !animation || !previewBottomStickActiveRef.current) {
        previewBottomStickFrameRef.current = undefined;
        return;
      }

      const latestTarget = Math.max(
        0,
        currentRoot.scrollHeight - currentRoot.clientHeight,
      );
      previewBottomStickTargetRef.current = latestTarget;

      const progress = clamp(
        (now - animation.start) / animation.duration,
        0,
        1,
      );
      const eased = easeOutCubic(progress);
      const next = animation.from + (latestTarget - animation.from) * eased;
      const token = previewSuppressTokenRef.current + 1;

      previewSuppressTokenRef.current = token;
      suppressPreviewScrollRef.current = true;
      currentRoot.scrollTop = next;

      const remaining = Math.abs(latestTarget - currentRoot.scrollTop);
      if (progress >= 1 || remaining <= SYNC_TUNING.bottomStickSnapDistance) {
        currentRoot.scrollTop = latestTarget;
        previewBottomStickFrameRef.current = undefined;
        previewBottomStickAnimationRef.current = undefined;
        previewBottomStickTargetRef.current = undefined;
        previewBottomStickActiveRef.current = false;
        releasePreviewSuppressLater(token);
        return;
      }

      releasePreviewSuppressLater(token);
      previewBottomStickFrameRef.current = window.requestAnimationFrame(run);
    };

    previewBottomStickFrameRef.current = window.requestAnimationFrame(run);
  }, [
    cancelPreviewBottomStickAnimation,
    cancelPreviewCorrectionAnimation,
    cancelPreviewLiveFollowAnimation,
    releasePreviewSuppressLater,
  ]);

  const setEditorScrollTopProgrammatically = useCallback(
    (target: number) => {
      const view = editorViewRef.current;
      if (!view) return;

      const scrollDom = view.scrollDOM;
      const maxScrollTop = Math.max(
        0,
        scrollDom.scrollHeight - scrollDom.clientHeight,
      );
      const next = clamp(target, 0, maxScrollTop);
      if (
        Math.abs(scrollDom.scrollTop - next) <
        SYNC_TUNING.programmaticScrollEpsilon
      )
        return;

      const token = editorSuppressTokenRef.current + 1;
      editorSuppressTokenRef.current = token;
      suppressEditorScrollRef.current = true;
      scrollDom.scrollTop = next;
      releaseEditorSuppressLater(token);
    },
    [releaseEditorSuppressLater],
  );

  const setEditorScrollToLineProgrammatically = useCallback(
    (lineNumber: number) => {
      const view = editorViewRef.current;
      if (!view) return;

      const token = editorSuppressTokenRef.current + 1;
      editorSuppressTokenRef.current = token;
      suppressEditorScrollRef.current = true;
      scrollEditorToLine(view, lineNumber);
      releaseEditorSuppressLater(token);
    },
    [releaseEditorSuppressLater],
  );

  const rebuildScrollMap = useCallback(() => {
    const view = editorViewRef.current;
    const root = previewRootRef.current;
    if (!view || !root) return undefined;

    const nextMap = buildPreviewLineMap(view, root);
    scrollMapRef.current = nextMap;
    scrollMapDirtyRef.current = false;
    return nextMap;
  }, []);

  const canRebuildScrollMapNow = useCallback(() => {
    if (activeScrollSourceRef.current !== null) return false;
    if (
      SYNC_TUNING.deferRebuildWhilePointerInside &&
      pointerAreaRef.current !== null
    )
      return false;
    return true;
  }, []);

  const scheduleScrollMapRebuild = useCallback(() => {
    if (scrollMapRebuildTimerRef.current !== undefined) return;

    scrollMapRebuildTimerRef.current = window.setTimeout(() => {
      scrollMapRebuildTimerRef.current = undefined;
      if (!scrollMapDirtyRef.current) return;
      if (!canRebuildScrollMapNow()) return;
      rebuildScrollMap();
    }, SYNC_TUNING.scrollMapRebuildDelay);
  }, [canRebuildScrollMapNow, rebuildScrollMap]);

  const invalidateScrollMap = useCallback(() => {
    scrollMapDirtyRef.current = true;
    if (canRebuildScrollMapNow()) scheduleScrollMapRebuild();
  }, [canRebuildScrollMapNow, scheduleScrollMapRebuild]);

  const getOrBuildScrollMap = useCallback(() => {
    if (!scrollMapDirtyRef.current && scrollMapRef.current)
      return scrollMapRef.current;
    if (scrollMapRef.current && !canRebuildScrollMapNow())
      return scrollMapRef.current;
    return rebuildScrollMap();
  }, [canRebuildScrollMapNow, rebuildScrollMap]);

  const syncPreviewToCursorLine = useCallback(
    (line: number) => {
      // 只有用户正在滚 preview 时，才延迟 editor cursor reveal。
      // 如果 active source 是 editor，说明 editor 本来就是同步源，应该允许 preview 跟随。
      if (activeScrollSourceRef.current === "preview") {
        pendingCursorLineRef.current = line;
        return;
      }

      const root = previewRootRef.current;
      const lineMap = getOrBuildScrollMap();
      if (!root || !lineMap) {
        pendingCursorLineRef.current = line;
        return;
      }

      const range = getPreviewRangeForSourceLine(root, line);
      const previewY = range?.y ?? mapSourceLineToPreviewY(line, lineMap);
      if (previewY == null) return;

      const visibilityPadding = 48;
      const visibleTop = root.scrollTop + visibilityPadding;
      const visibleBottom =
        root.scrollTop + root.clientHeight - visibilityPadding;

      // 如果目标行已经在 preview 可视区内，不要为了固定 reveal 比例而强行滚动。
      if (range) {
        const rangeHeight = range.bottom - range.top;
        const visibleHeight = visibleBottom - visibleTop;
        const rangeIntersectsViewport =
          range.bottom >= visibleTop && range.top <= visibleBottom;
        const pointVisible =
          previewY >= visibleTop && previewY <= visibleBottom;

        if (
          pointVisible ||
          (rangeHeight <= visibleHeight && rangeIntersectsViewport)
        ) {
          pendingCursorLineRef.current = undefined;
          return;
        }
      } else if (previewY >= visibleTop && previewY <= visibleBottom) {
        pendingCursorLineRef.current = undefined;
        return;
      }

      const target =
        previewY - root.clientHeight * SYNC_TUNING.cursorRevealRatio;
      pendingCursorLineRef.current = undefined;
      setPreviewScrollTopWithCorrection(
        clamp(target, 0, lineMap.previewMaxScrollTop),
        SYNC_TUNING.cursorRevealSmoothDuration,
      );
    },
    [getOrBuildScrollMap, setPreviewScrollTopWithCorrection],
  );

  const scheduleCursorSync = useCallback(
    (line: number) => {
      pendingCursorLineRef.current = line;
      if (cursorSyncFrameRef.current !== undefined) return;

      cursorSyncFrameRef.current = window.requestAnimationFrame(() => {
        cursorSyncFrameRef.current = undefined;
        const pendingLine = pendingCursorLineRef.current;
        if (pendingLine !== undefined) syncPreviewToCursorLine(pendingLine);
      });
    },
    [syncPreviewToCursorLine],
  );

  const releaseActiveSource = useCallback(() => {
    activeScrollSourceRef.current = null;

    if (scrollMapDirtyRef.current && canRebuildScrollMapNow()) {
      scheduleScrollMapRebuild();
    }

    const pendingLine = pendingCursorLineRef.current;
    if (pendingLine !== undefined) {
      pendingCursorLineRef.current = undefined;

      window.requestAnimationFrame(() => {
        syncPreviewToCursorLine(pendingLine);
      });
    }
  }, [
    canRebuildScrollMapNow,
    scheduleScrollMapRebuild,
    syncPreviewToCursorLine,
  ]);

  const markActiveSource = useCallback(
    (source: Exclude<ScrollSource, null>) => {
      activeScrollSourceRef.current = source;
      window.clearTimeout(scrollSourceReleaseTimerRef.current);
      scrollSourceReleaseTimerRef.current = window.setTimeout(
        releaseActiveSource,
        SYNC_TUNING.scrollSourceReleaseDelay,
      );
    },
    [releaseActiveSource],
  );

  const syncPreviewFromEditor = useCallback(() => {
    const view = editorViewRef.current;
    const root = previewRootRef.current;
    if (!view || !root) return;

    const editorScrollTop = view.scrollDOM.scrollTop;
    const editorMaxScrollTop = Math.max(
      0,
      view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight,
    );
    const previewMaxScrollTop = Math.max(
      0,
      root.scrollHeight - root.clientHeight,
    );

    if (isEditorAtBottom(view)) {
      startPreviewBottomStick();
      return;
    }

    const lineMap = getOrBuildScrollMap();
    if (
      !lineMap ||
      lineMap.lines.length < 2 ||
      lineMap.lines.length !== lineMap.previewYs.length
    ) {
      setPreviewScrollTopLive(
        mapByGlobalRatio(
          editorScrollTop,
          editorMaxScrollTop,
          previewMaxScrollTop,
        ),
      );
      return;
    }

    const sourceLine = getEditorTopVisibleLine(view);
    const semanticTarget = mapSourceLineToPreviewY(sourceLine, lineMap);
    if (semanticTarget == null) {
      setPreviewScrollTopLive(
        mapByGlobalRatio(
          editorScrollTop,
          editorMaxScrollTop,
          previewMaxScrollTop,
        ),
      );
      return;
    }

    const ratioTarget = mapByGlobalRatio(
      editorScrollTop,
      editorMaxScrollTop,
      previewMaxScrollTop,
    );
    const semanticWeight = clamp(
      SYNC_TUNING.editorToPreviewSemanticWeight,
      0,
      1,
    );
    const target =
      semanticTarget * semanticWeight + ratioTarget * (1 - semanticWeight);

    setPreviewScrollTopLive(clamp(target, 0, lineMap.previewMaxScrollTop));
  }, [getOrBuildScrollMap, setPreviewScrollTopLive, startPreviewBottomStick]);

  const settleEditorFromPreview = useCallback(() => {
    const root = previewRootRef.current;
    const view = editorViewRef.current;
    if (!root || !view) return;

    const lineMap = getOrBuildScrollMap();
    if (
      !lineMap ||
      lineMap.previewYs.length < 2 ||
      lineMap.previewYs.length !== lineMap.lines.length
    )
      return;

    const previewScrollTop = root.scrollTop;
    const previewMaxScrollTop = Math.max(
      0,
      root.scrollHeight - root.clientHeight,
    );
    const editorMaxScrollTop = Math.max(
      0,
      view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight,
    );

    if (previewScrollTop >= previewMaxScrollTop - 2) {
      setEditorScrollTopProgrammatically(editorMaxScrollTop);
      return;
    }

    const line = mapPreviewYToSourceLine(previewScrollTop, lineMap);
    if (line == null) return;

    setEditorScrollToLineProgrammatically(line);
  }, [
    getOrBuildScrollMap,
    setEditorScrollToLineProgrammatically,
    setEditorScrollTopProgrammatically,
  ]);

  const syncEditorFromPreview = useCallback(() => {
    const root = previewRootRef.current;
    const view = editorViewRef.current;
    if (!root || !view) return;

    const previewScrollTop = root.scrollTop;
    const previewMaxScrollTop = Math.max(
      0,
      root.scrollHeight - root.clientHeight,
    );
    const editorMaxScrollTop = Math.max(
      0,
      view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight,
    );

    if (previewScrollTop >= previewMaxScrollTop - 2) {
      setEditorScrollTopProgrammatically(editorMaxScrollTop);
    } else {
      setEditorScrollTopProgrammatically(
        mapByGlobalRatio(
          previewScrollTop,
          previewMaxScrollTop,
          editorMaxScrollTop,
        ),
      );
    }

    window.clearTimeout(previewSettleTimerRef.current);
    previewSettleTimerRef.current = window.setTimeout(() => {
      if (activeScrollSourceRef.current === "preview")
        settleEditorFromPreview();
    }, SYNC_TUNING.previewToEditorSettleDelay);
  }, [setEditorScrollTopProgrammatically, settleEditorFromPreview]);

  const scheduleEditorToPreviewSync = useCallback(() => {
    if (editorToPreviewFrameRef.current !== undefined) return;

    editorToPreviewFrameRef.current = window.requestAnimationFrame(() => {
      editorToPreviewFrameRef.current = undefined;
      syncPreviewFromEditor();
    });
  }, [syncPreviewFromEditor]);

  const schedulePreviewToEditorSync = useCallback(() => {
    if (previewToEditorFrameRef.current !== undefined) return;

    previewToEditorFrameRef.current = window.requestAnimationFrame(() => {
      previewToEditorFrameRef.current = undefined;
      syncEditorFromPreview();
    });
  }, [syncEditorFromPreview]);

  const handlePreviewContentChange = useCallback(() => {
    invalidateScrollMap();

    const view = editorViewRef.current;
    if (
      activeScrollSourceRef.current === "editor" &&
      view &&
      isEditorAtBottom(view)
    ) {
      window.requestAnimationFrame(() => startPreviewBottomStick());
      return;
    }

    if (activeScrollSourceRef.current === "editor")
      scheduleEditorToPreviewSync();
    else if (activeScrollSourceRef.current === "preview")
      schedulePreviewToEditorSync();
  }, [
    invalidateScrollMap,
    scheduleEditorToPreviewSync,
    schedulePreviewToEditorSync,
    startPreviewBottomStick,
  ]);

  const handleEditorViewChange = useCallback(
    (view: EditorView | null) => {
      editorViewRef.current = view;
      setEditorView(view);
      invalidateScrollMap();
    },
    [invalidateScrollMap],
  );

  const handlePreviewRootReady = useCallback(
    (root: HTMLDivElement | null) => {
      previewRootRef.current = root;
      setPreviewRoot(root);
      invalidateScrollMap();
    },
    [invalidateScrollMap],
  );

  const handlePreviewSyncPositionChange = useCallback(
    (position: PreviewSyncPosition) => {
      if (position.source !== "cursor") return;
      latestCursorLineRef.current = position.line;
      scheduleCursorSync(position.line);
    },
    [scheduleCursorSync],
  );

  const handleEditorContentEdit = useCallback(
    (line?: number) => {
      if (line == null) return;

      latestCursorLineRef.current = line;

      // 内容编辑来自 editor，本来就应该让 preview 跟随 editor。
      // 不要在这里走 preview -> editor，也不要把 active source 设成 preview。
      if (activeScrollSourceRef.current === "preview") {
        pendingCursorLineRef.current = line;
        return;
      }

      markActiveSource("editor");
      scheduleCursorSync(line);
    },
    [markActiveSource, scheduleCursorSync],
  );

  const handleEditorPointerEnter = useCallback(() => {
    pointerAreaRef.current = "editor";
  }, []);

  const handleEditorPointerLeave = useCallback(() => {
    if (pointerAreaRef.current === "editor") {
      pointerAreaRef.current = null;
      if (scrollMapDirtyRef.current) scheduleScrollMapRebuild();
    }
  }, [scheduleScrollMapRebuild]);

  const handlePreviewPointerEnter = useCallback(() => {
    pointerAreaRef.current = "preview";
  }, []);

  const handlePreviewPointerLeave = useCallback(() => {
    if (pointerAreaRef.current === "preview") {
      pointerAreaRef.current = null;
      if (scrollMapDirtyRef.current) scheduleScrollMapRebuild();
    }
  }, [scheduleScrollMapRebuild]);

  useEffect(() => {
    onAssetObjectUrlsChangeRef.current = onAssetObjectUrlsChange;
  }, [onAssetObjectUrlsChange]);

  useEffect(() => {
    if (!onAssetObjectUrlsChangeRef.current) {
      return undefined;
    }
    if (assets.length === 0) {
      onAssetObjectUrlsChangeRef.current({});
      return undefined;
    }

    const assetsNeedingObjectUrls = assets.filter((asset) => !asset.publicUrl);
    if (assetsNeedingObjectUrls.length === 0) {
      onAssetObjectUrlsChangeRef.current({});
      return undefined;
    }

    let disposed = false;
    const objectUrls: Record<string, string> = {};

    void Promise.all(
      assetsNeedingObjectUrls.map(async (asset) => {
        const response = await fetch(
          buildApiUrl(`/assets/blob?key=${encodeURIComponent(asset.key)}`),
          {
            credentials: "include",
          },
        );
        if (!response.ok) return;

        const blob = await response.blob();
        if (disposed) return;

        objectUrls[asset.key] = URL.createObjectURL(blob);
      }),
    ).then(() => {
      if (!disposed) onAssetObjectUrlsChangeRef.current?.(objectUrls);
    });

    return () => {
      disposed = true;
      for (const url of Object.values(objectUrls)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [assets]);

  useEffect(() => {
    invalidateScrollMap();
  }, [invalidateScrollMap, markdown]);

  useEffect(() => {
    if (!editorView || !previewRoot) return;
    scheduleCursorSync(latestCursorLineRef.current);
  }, [editorView, previewRoot, scheduleCursorSync]);

  useEffect(() => {
    if (!editorView) return undefined;

    const handleEditorScroll = () => {
      if (suppressEditorScrollRef.current) return;

      if (isEditorAtBottom(editorView)) {
        // editor 已在底部时，bottom-stick controller 接管 preview。
      } else {
        cancelPreviewBottomStickAnimation(false);
        cancelPreviewCorrectionAnimation();
      }

      if (
        pointerAreaRef.current !== null &&
        pointerAreaRef.current !== "editor"
      )
        return;
      if (
        activeScrollSourceRef.current !== null &&
        activeScrollSourceRef.current !== "editor"
      )
        return;

      pointerAreaRef.current = "editor";
      markActiveSource("editor");
      scheduleEditorToPreviewSync();
    };

    const scrollDom = editorView.scrollDOM;
    scrollDom.addEventListener("scroll", handleEditorScroll, { passive: true });
    return () => scrollDom.removeEventListener("scroll", handleEditorScroll);
  }, [
    cancelPreviewBottomStickAnimation,
    cancelPreviewCorrectionAnimation,
    editorView,
    markActiveSource,
    scheduleEditorToPreviewSync,
  ]);

  useEffect(() => {
    if (!previewRoot) return undefined;

    const handlePreviewScroll = () => {
      if (suppressPreviewScrollRef.current) return;

      cancelPreviewScrollAnimation();

      if (
        pointerAreaRef.current !== null &&
        pointerAreaRef.current !== "preview"
      )
        return;
      if (
        activeScrollSourceRef.current !== null &&
        activeScrollSourceRef.current !== "preview"
      )
        return;

      pointerAreaRef.current = "preview";
      markActiveSource("preview");
      schedulePreviewToEditorSync();
    };

    previewRoot.addEventListener("scroll", handlePreviewScroll, {
      passive: true,
    });
    return () => previewRoot.removeEventListener("scroll", handlePreviewScroll);
  }, [
    cancelPreviewScrollAnimation,
    markActiveSource,
    previewRoot,
    schedulePreviewToEditorSync,
  ]);

  useEffect(() => {
    const view = editorView;
    const root = previewRoot;
    if (typeof ResizeObserver === "undefined" || (!view && !root))
      return undefined;

    const observer = new ResizeObserver(invalidateScrollMap);
    if (view) observer.observe(view.scrollDOM);
    if (root) observer.observe(root);

    return () => observer.disconnect();
  }, [editorView, invalidateScrollMap, previewRoot]);

  useEffect(() => {
    const handleWindowResize = () => invalidateScrollMap();
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [invalidateScrollMap]);

  useEffect(() => {
    return () => {
      window.clearTimeout(scrollSourceReleaseTimerRef.current);
      window.clearTimeout(scrollMapRebuildTimerRef.current);
      window.clearTimeout(previewSettleTimerRef.current);

      if (editorToPreviewFrameRef.current !== undefined)
        window.cancelAnimationFrame(editorToPreviewFrameRef.current);
      if (previewToEditorFrameRef.current !== undefined)
        window.cancelAnimationFrame(previewToEditorFrameRef.current);
      if (cursorSyncFrameRef.current !== undefined)
        window.cancelAnimationFrame(cursorSyncFrameRef.current);

      cancelPreviewScrollAnimation();
    };
  }, [cancelPreviewScrollAnimation]);

  return (
    <div className={styles.root}>
      <div
        className={styles.column}
        onPointerEnter={handleEditorPointerEnter}
        onPointerLeave={handleEditorPointerLeave}
        onPointerDown={handleEditorPointerEnter}
        onTouchStart={handleEditorPointerEnter}
      >
        <MarkdownEditor
          value={markdown}
          onChange={onChange}
          onPreviewSyncPositionChange={handlePreviewSyncPositionChange}
          onEditorViewChange={handleEditorViewChange}
          onContentEdit={handleEditorContentEdit}
          insertRequest={insertRequest}
          onInsertConsumed={onInsertConsumed}
          onPasteImages={onPasteImages}
        />
      </div>
      <div
        className={mergeClasses(styles.column, styles.previewColumn)}
        onPointerEnter={handlePreviewPointerEnter}
        onPointerLeave={handlePreviewPointerLeave}
        onPointerDown={handlePreviewPointerEnter}
        onTouchStart={handlePreviewPointerEnter}
      >
        <MarkdownPreview
          markdown={markdown}
          resolveResourceUrl={resolveResourceUrl}
          onPreviewRootReady={handlePreviewRootReady}
          onPreviewContentChange={handlePreviewContentChange}
        />
      </div>
    </div>
  );
}
