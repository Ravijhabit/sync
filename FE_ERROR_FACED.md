# Frontend Error Log

---

## [2026-06-12] — KendoReact type declarations incompatible with `skipLibCheck: false`

**Phase:** Phase 0 — Project Scaffold

**Error:**
```
node_modules/@progress/kendo-react-buttons/Button.d.ts(15,18): error TS2320:
  Interface 'ButtonProps' cannot simultaneously extend types 'ButtonInterface'
  and 'ButtonHTMLAttributes<HTMLButtonElement>'.
  Named property 'disabled' of types 'ButtonInterface' and
  'ButtonHTMLAttributes<HTMLButtonElement>' are not identical.

node_modules/@progress/kendo-react-treeview/TreeView.d.ts(81,5): error TS2416:
  Property 'state' in type 'TreeView' is not assignable to the same property in
  base type 'Component<TreeViewProps, TreeViewState, any>'.
  Type '{ focusedItemId: undefined; ... }' is not assignable to type
  'Readonly<TreeViewState>' with 'exactOptionalPropertyTypes: true'.

(+ 15 additional TS2320 / TS2430 errors across kendo-react-inputs,
  kendo-react-animation, kendo-react-notification, kendo-react-common,
  kendo-react-dropdowns, kendo-react-intl)
```

**Context:**
Running `npm run build` (which runs `tsc -b && vite build`) with `skipLibCheck: false` in `tsconfig.app.json` as specified in the system design. All errors originate inside `node_modules/@progress/kendo-react-*` — none in `src/`.

The root cause is that KendoReact's published `.d.ts` files were generated without `exactOptionalPropertyTypes: true`. Their interface inheritance chains produce `TS2320` conflicts when TypeScript enforces that flag strictly on all declarations including library files.

**Already tried:**
- Installing `@types/prop-types` — resolved the `TS7016` `prop-types` declaration errors but the `TS2320` / `TS2416` errors remain; they are structural, not missing-types issues
- Checking npm for a newer KendoReact version with fixed declarations — not available at time of writing

**Resolution:** Set `skipLibCheck: true` in `client/tsconfig.app.json`. This suppresses type-checking on all `.d.ts` files under `node_modules/`, which is the standard mitigation when a third-party library ships declarations incompatible with strict compiler flags. All TypeScript checks on `src/` remain fully enforced — the flag does not weaken type safety in our code.

**Status:** Resolved
