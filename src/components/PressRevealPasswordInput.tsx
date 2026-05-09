import { Button, Input, makeStyles, tokens } from '@fluentui/react-components'
import type { InputProps } from '@fluentui/react-components'
import { EyeRegular } from '@fluentui/react-icons'
import { useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

const useStyles = makeStyles({
  revealButton: {
    minWidth: '28px',
    width: '28px',
    height: '28px',
    color: tokens.colorNeutralForeground3,
  },
})

type PressRevealPasswordInputProps = Omit<InputProps, 'type' | 'contentAfter'>

export function PressRevealPasswordInput(props: PressRevealPasswordInputProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)

  const show = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setRevealed(true)
  }
  const hide = (event?: PointerEvent<HTMLButtonElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setRevealed(false)
  }
  const showWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') setRevealed(true)
  }
  const hideWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') setRevealed(false)
  }

  return (
    <Input
      {...props}
      type={revealed ? 'text' : 'password'}
      contentAfter={
        <Button
          aria-label={t('auth.holdToShowPassword')}
          appearance="transparent"
          className={styles.revealButton}
          icon={<EyeRegular />}
          onBlur={() => setRevealed(false)}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={showWithKeyboard}
          onKeyUp={hideWithKeyboard}
          onPointerCancel={hide}
          onPointerDown={show}
          onPointerLeave={hide}
          onPointerUp={hide}
          size="small"
          title={t('auth.holdToShowPassword')}
          type="button"
        />
      }
    />
  )
}
