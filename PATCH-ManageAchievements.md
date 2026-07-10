# ManageAchievements.tsx patch instructions

Add two things to the existing `components/admin/ManageAchievements.tsx`:

## 1. Import OddsConfigPanel at the top

```ts
import { OddsConfigPanel } from "./OddsConfigPanel";
```

## 2. Add OddsConfigPanel inside ManageRow's return, after the pool/max-supply section

Find the closing `</details>` tag at the bottom of ManageRow's return statement
and add the OddsConfigPanel just before it:

```tsx
      {/* Randomize odds — new section */}
      <OddsConfigPanel
        achievement={a}
        allAchievements={allAchievements}
        inputClass={inputClass}
      />

    </details>  {/* existing closing tag */}
```

That's the only change needed to the existing file.
The OddsConfigPanel is a self-contained collapsible — it won't visually
appear unless the owner clicks "🎲 Randomize this achievement" inside each
achievement's manage row, so it doesn't break the existing layout.
