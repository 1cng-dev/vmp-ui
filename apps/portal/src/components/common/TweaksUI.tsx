import { TweaksPanel, TweakSection, TweakRadio, TweakColor } from './TweaksPanel'
import { TweakState } from './useTweaks'

interface TweaksUIProps {
  tw: TweakState
  setTweak: (keyOrEdits: keyof TweakState | Partial<TweakState>, value?: any) => void
}

export const TweaksUI = ({ tw, setTweak }: TweaksUIProps) => {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Appearance">
        <TweakRadio
          label="Theme"
          value={tw.theme}
          options={[{value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}]}
          onChange={(v) => setTweak('theme' as keyof TweakState, v)}
        />
        <TweakColor
          label="Accent"
          value={tw.accent}
          options={['#4F6FE3', '#3D9C6E', '#C25A4B', '#8060D4', '#C9883A']}
          onChange={(v) => setTweak('accent' as keyof TweakState, v)}
        />
      </TweakSection>
    </TweaksPanel>
  )
}
