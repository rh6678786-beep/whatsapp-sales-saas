# UI Design Contract — Phase 1: Features Tab

## Design System Alignment

### Current Patterns (Already Implemented)

The sidebar follows established patterns from the existing codebase:

| Element | Pattern | Source |
|---------|---------|--------|
| Main tab icon | lucide-react icons with color prefix | `Zap` icon, `text-rose-500` |
| Sub-tab list | border-l-2 left border with gradient background | `border-rose-500/40`, `from-rose-500/20` |
| Active indicator | colored side bar + full-width dark background | `bg-rose-400` side bar |
| Expand/collapse | toggle on click, ChevronDown/ChevronRight | Same as WhatsApp/Products |
| Page transition | framer-motion AnimatePresence with key | Same as all tabs |
| localStorage | persist expanded state and active sub-tab | Same pattern |

### Color Tokens

```
Features tab:    rose-500 (active), rose-400 (indicator), rose-500/40 (border), from-rose-500/20 (gradient)
```

### Existing Sub-tab Mapping

| ID | Label | Icon | Component | Route Key |
|----|-------|------|-----------|-----------|
| broadcast | Broadcast | Megaphone | `<BroadcastManager />` | broadcast |
| reengage | Re-Engage | Users | `<ReEngagement />` | reengage |
| autopost | AI Publisher | Megaphone | `<AutoPublisher />` | autopost |
| tester | Simulator | MessageSquare | `<BotTester />` | tester |
| orders | Verification | ShieldCheck | `<OrderVerifier />` | orders |

## Interaction Contracts

1. **Click Features tab**: If inactive, activate and expand; if active, toggle expand/collapse
2. **Click sub-tab**: Set as active, keep Features expanded, render corresponding component
3. **Click another main tab**: Collapse Features, switch to that tab
4. **Browser refresh**: Restore last active sub-tab from localStorage
5. **Verification badge**: Show pending count on orders sub-tab

## States

- **Default**: Features expanded, Broadcast active
- **Active**: rose-500 color, rose-400 left bar indicator, full-width active background
- **Hover**: lighter background on main tab and sub-tab items
- **Collapsed**: Features tab name visible, sub-tabs hidden, ChevronRight icon
- **Mobile (md breakpoint)**: Sidebar hidden behind hamburger menu

## Layout Spec

- Main tab height: 44px with 10px vertical padding
- Sub-tab height: 36px with 6px left padding (indentation)
- Sub-tab left margin: 16px from main tab edge
- Active indicator: 3px left border
- z-index: sidebar at z-50, overlay at z-40

## Responsive Behavior

- Below `md` (768px): sidebar collapses to overlay drawer
- Toggle via hamburger button (top-left)
- Same pattern as existing responsive implementation

---

*Generated: 2026-05-31*
