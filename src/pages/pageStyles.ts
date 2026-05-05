import { makeStyles, tokens } from '@fluentui/react-components'

export const usePageStyles = makeStyles({
  page: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    width: '100%',
    maxWidth: 'none',
  },
  header: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
  },
  grid: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 960px)': {
      gridTemplateColumns: '1fr',
    },
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
