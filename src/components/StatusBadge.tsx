import { Badge } from '@fluentui/react-components'
import type { BadgeProps } from '@fluentui/react-components'

type StatusBadgeProps = {
  status: NonNullable<BadgeProps['color']>
  children: string
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <Badge appearance="filled" color={status}>
      {children}
    </Badge>
  )
}
