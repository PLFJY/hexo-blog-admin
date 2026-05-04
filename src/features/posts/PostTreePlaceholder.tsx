import { Text, Title3 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { buildPostAssetPaths, buildPostPaths } from './postPathUtils'
import { usePageStyles } from '../../pages/pageStyles'

export function PostTreePlaceholder() {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const paths = buildPostPaths({
    postsDir: 'source/_posts',
    relativeId: 'ap-csa/00-about-ap-csa',
  })
  const assetPaths = buildPostAssetPaths({
    postsDir: 'source/_posts',
    relativeId: 'ap-csa/00-about-ap-csa',
    filename: 'ap-csa-range.png',
  })

  return (
    <section className={styles.card}>
      <Title3>{t('posts.pathRules')}</Title3>
      <Text>{t('posts.relativeId')}</Text>
      <Text>{t('posts.indexTodo')}</Text>
      <pre className={styles.codeBlock}>
        <code>{`${paths.postPath}
${assetPaths.finalRepoPath}
Markdown: ${assetPaths.markdownPath}`}</code>
      </pre>
    </section>
  )
}
