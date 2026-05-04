import { Body1, Title1 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { PostTreePlaceholder } from '../features/posts/PostTreePlaceholder'
import { usePageStyles } from './pageStyles'

export function PostsPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('posts.title')}</Title1>
        <Body1>{t('posts.description')}</Body1>
      </header>
      <EmptyState title={t('posts.emptyTitle')} description={t('posts.emptyDescription')} />
      <PostTreePlaceholder />
    </section>
  )
}
