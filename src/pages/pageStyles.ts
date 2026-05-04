import { makeStyles, tokens } from '@fluentui/react-components'

export const usePageStyles = makeStyles({
  page: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    maxWidth: '1040px',
  },
  header: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
  },
  grid: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
  },
  card: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  codeBlock: {
    margin: 0,
    overflowX: 'auto',
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  editor: {
    minHeight: '360px',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  inlineList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
})
