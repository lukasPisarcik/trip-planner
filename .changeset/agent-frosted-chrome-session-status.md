---
'trip-planner': minor
---

Give the agent workspace frosted-glass chrome and add live session status to the sidebar. The navbar's translucent blur is strengthened (`bg-background/70 backdrop-blur-md`), and the agent composer becomes a floating frosted bar that messages scroll beneath — matching the navbar — instead of a solid bar pinned at the bottom. The trip-ready card now lives inside that frosted band. The same treatment is mirrored in the trip-page AI side panel.

AI sessions in the sidebar now show a T3-style status: a colored dot plus label — amber pulsing **Working…** for the session generating right now (tracked via a small global activity store), green **Completed**, red **Failed**, and grey **Interrupted** for a turn that was cut off. The timestamp moves to a hover tooltip.
