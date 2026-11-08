# Podium

A free, offline presentation editor with a PowerPoint-style interface. It opens and saves real `.pptx` files.
No account, no install, no internet. Your files stay on your computer.

## Run it

Double-click **Start Podium.bat**. It opens in its own window using Microsoft Edge or Chrome.

PowerShell:

```
& "C:\Users\vedan\Desktop\Podium\Start Podium.bat"
```

## Good to know

- **Save** writes a standard `.pptx`. The files were tested by opening them in Microsoft PowerPoint.
- **Crash recovery:** an unsaved copy is kept in browser storage and offered the next time you start.
- **Fonts** come from your system. A deck using a font you don't have will show a substitute, as in PowerPoint.
- **SmartArt** is inserted as a group of editable shapes. Right-click it and choose *Edit SmartArt Text* to regenerate it from text. In PowerPoint it opens as shapes, not as SmartArt.
- **Create PDF** makes one picture per slide. For a PDF with selectable text, use *File > Print* and choose "Save as PDF".
- **Create a Video** records the slides with crossfades. It does not record animations.
- **Video files:** `.webm` plays in Podium but PowerPoint may refuse it. Use `.mp4` for files you will share.

## Keyboard shortcuts

See *File > Options* for the full list. The main ones match PowerPoint: `F5`, `Shift+F5`, `Ctrl+M`, `Ctrl+D`, `Ctrl+G`, `Ctrl+Z`, `Ctrl+B/I/U`.

## Feature checklist

`[x]` works, `[~]` partly works, `[ ]` missing. The scope is PowerPoint's main ribbon features. This is a judgment-based list, not an official Microsoft inventory.

### File
- [x] New blank presentation
- [x] New from themes (12 built in)
- [x] Templates (4 sample decks)
- [x] Open `.pptx`
- [x] Save and Save As `.pptx`
- [x] Recent files
- [x] Document properties and statistics
- [x] Print: full slides, notes pages, outline, handouts (1, 2, 3, 4, 6, 9 per page)
- [x] Export to PDF
- [x] Export slides as PNG or JPEG
- [~] Export to video (no animations)
- [~] AutoSave (crash recovery copy only, not continuous saving to the file)
- [~] Compress media (pictures only)
- [ ] Open or save `.ppt`, `.ppsx`, `.potx`, `.odp`
- [ ] Cloud sharing and real-time co-authoring
- [ ] Version history
- [ ] Password protection

### Home
- [x] Cut, copy, paste, including pictures and text from other apps
- [x] Format Painter
- [x] New Slide with layout gallery
- [x] Change layout, Reset slide
- [x] Sections
- [x] Font, size, grow and shrink
- [x] Bold, italic, underline, strikethrough
- [x] Text shadow, character spacing, change case
- [x] Font color and highlight color
- [x] Clear formatting
- [x] Bullets and numbering galleries
- [x] List levels and indents
- [x] Line spacing and paragraph dialog
- [x] Text columns
- [x] Alignment, text direction, vertical text alignment
- [x] Convert text to SmartArt
- [x] Arrange menu
- [x] Quick Styles
- [x] Shape fill, outline, effects
- [x] Find, Replace, Select
- [ ] Dictate
- [ ] Designer and Copilot (AI features)

### Insert
- [x] Tables with grid picker
- [x] Pictures, including drag and drop
- [x] Screenshot
- [x] Photo Album
- [x] Shapes (141 presets, most drawn to match PowerPoint)
- [x] Links and Action settings
- [x] Comments with replies
- [x] Text Box
- [x] Header and Footer
- [x] Date and time, slide number
- [x] Symbols
- [x] Video and audio files
- [x] Record audio, screen recording
- [~] Icons (about 45 built in, no online library)
- [~] SmartArt (17 layouts, saved as shapes)
- [~] Charts (14 types, PowerPoint has more)
- [~] WordArt (styles, but no warp or text-on-path)
- [~] Equations (Unicode text, not a true equation editor)
- [ ] Stock images and online pictures
- [ ] 3D models
- [ ] Zoom (summary and slide zoom)
- [ ] Embedded objects (OLE)

### Draw
- [x] Pens and highlighters with custom colors
- [x] Stroke eraser
- [ ] Ink to shape, text or math
- [ ] Ink replay and drawing ruler

### Design
- [x] Theme gallery
- [x] Variants: theme colors, theme fonts, background styles
- [x] Customize theme colors
- [x] Slide size, standard and custom
- [x] Format Background: solid, gradient, picture, pattern
- [~] Browse for themes (takes colors and fonts, not layouts)

### Transitions
- [x] Effect options per transition
- [x] Duration, Apply To All
- [x] Advance on click or after a time
- [~] Transition gallery (24 effects, PowerPoint has about 48)
- [ ] Transition sounds
- [ ] Morph (imported as a fade)

### Animations
- [x] Entrance, emphasis and exit effects (34 effects)
- [x] Preset motion paths (8)
- [x] Effect options, by-paragraph builds
- [x] Start on click, with previous, after previous
- [x] Duration, delay, repeat, reorder
- [x] Add Animation, Animation Pane, Animation Painter
- [ ] Triggers
- [ ] Custom drawn motion paths

### Slide Show
- [x] From Beginning, From Current Slide
- [x] Custom shows
- [x] Set Up Show: speaker, window, kiosk, loop, slide range
- [x] Hide slide
- [x] Rehearse Timings
- [x] Presenter View: notes, next slide, timer
- [x] Pen, highlighter, laser, eraser during a show
- [x] Black and white screen, see all slides, jump to slide number
- [x] Links and action buttons during a show
- [ ] Record narration with the show
- [ ] Live subtitles

### Review
- [x] Spell check (uses the browser's dictionary, red underlines while editing)
- [x] Word count
- [x] Accessibility checker
- [x] Comments: add, reply, resolve, delete, next and previous
- [ ] Thesaurus and Translate
- [ ] Compare presentations

### View
- [x] Normal, Outline, Slide Sorter, Notes Page, Reading View
- [x] Slide Master with layouts: edit, add, delete, rename, add placeholders
- [x] Ruler, gridlines, guides, snap to grid
- [x] Zoom and fit
- [x] Grayscale
- [ ] Handout Master and Notes Master
- [ ] New Window, Macros (VBA)

### Editing and Format tabs
- [x] Move, resize, rotate, flip, nudge
- [x] Smart guides
- [x] Yellow adjust handles on common shapes
- [x] Connectors that stay attached to shapes
- [x] Group, ungroup, edit inside groups
- [x] Align and distribute, z-order, Selection Pane
- [x] Freeform and scribble drawing
- [x] Undo and redo
- [x] Shape effects: shadow, glow, reflection, soft edges, 3-D rotation
- [x] Gradient, picture and pattern fills
- [x] Line styles: dashes, arrowheads, caps, joins
- [x] Text autofit: shrink on overflow, resize shape to fit
- [x] Picture crop, crop to shape, aspect ratio crop
- [x] Picture corrections, color, transparency
- [x] Picture styles and alt text
- [x] Table Design: styles, banding, shading, borders
- [x] Table Layout: insert and delete, merge and split, sizes, alignment
- [x] Chart Design: edit data, change type, title, legend, labels, gridlines, colors
- [~] Remove Background (removes flat backgrounds connected to the edges only)
- [~] Artistic effects (blur only)
- [~] Media playback options (volume, loop, autoplay work in Podium but are not saved to `.pptx`)
- [ ] Merge Shapes
- [ ] Edit Points
- [ ] Trim video and video effects

## Known differences from PowerPoint

- It has its own name and icon. The layout and workflow follow PowerPoint, but it is not a pixel-identical copy.
- A deck with several slide masters keeps its look, but extra masters are merged into layouts of the first.
- `.emf` and `.wmf` pictures, common in old decks, can't be drawn by a browser and appear blank.
- Some rarely used shapes, such as curved block arrows and scrolls, look a little different from PowerPoint's.
- The ribbon scrolls sideways on narrow windows instead of collapsing its groups.
