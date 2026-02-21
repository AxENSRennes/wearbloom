# Expo App Notes

## Dev Troubleshooting

### `__internalInstanceHandle` error in Element Inspector

If you see logs like:

`TypeError: Cannot read property '__internalInstanceHandle' of null`

with a stack containing:

- `devmenu/elementinspector/InspectorOverlay`
- `getInspectorDataForViewAtPoint`
- `ReactFabricPublicInstance`

this is a React Native / Expo devtools Inspector issue, not a production
runtime crash in Wearbloom business logic.

Recommended mitigation:

1. Disable Element Inspector for this screen/session.
2. Use app logs / React DevTools for debugging instead.
3. Restart Metro (`pnpm dev:expo`) if the inspector state gets stuck.

If this becomes frequent, plan a dedicated dependency-upgrade ticket for Expo
SDK / React Native patch alignment.

