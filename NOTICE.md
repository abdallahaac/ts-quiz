# Third-party assets

The production component script is generated from the locked npm package
`@brightspace-ui/core` and its transitive dependencies. Only the quiz's button,
alert, icon and collapsible-panel components are imported as entry points.
The supplied `brightspace-core-bundle.js` is not used or distributed by this build.

Brightspace UI Core and Brightspace UI Intl are Copyright D2L Corporation,
licensed under Apache License 2.0. Vite generates `licenses/components.md` with
the versions, licenses and notices of the npm packages included in the component
script. The Core and Intl Apache license files are also copied into `licenses/`.
All components, icon data and language dictionaries are bundled without modifying
third-party implementation files. Original component font service URLs remain.

`fonts/` contains Lato Latin regular, bold and italic files supplied by
@fontsource/lato, licensed under the SIL Open Font License 1.1. See
`licenses/Lato-OFL.txt` in the build.

The original HTML's Brightspace hosted theme stylesheet and course contentstyler
override remain managed by Brightspace.
