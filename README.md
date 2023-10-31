# Table Builder

✨ New: **Update** existing tables with new data

_Table Builder_ lets you create and update tables by pasting tabular data from your spread sheets.

For each entry in the spread sheet, _Table Builder_ creates an instance of your original cell component, positions it in a grid and updates the cell's first child of type `text` with the data entry from the spreadsheet (Excel, Numbers, etc).

## Privacy

_Table Builder_ doesn't send your table data anywhere outside of Figma.

## Demo

* [https://www.youtube.com/watch?v=Y4QhE9EZ4pY](Video – Generate new table)
* [https://youtu.be/xEiioTtt18I](Video – Update existing table)

## Usage

### Create a new table

1. Create a component that contains a text label (make sure the text label's `horizontal resizing` property is set to `Hug` if it uses auto layout)
2. Select an **instance** of that component
3. In the plugins menu, select **Table Builder** and then **Generate new table**
4. Copy tabular data from the spreadsheet and **paste** it into the text area of the plugin's UI
5. Click on the **Generate table** button

### Update an existing table

1. Select a table that was created with Table Builder
2. In the plugins menu, select **Table Builder** and then **Update existing table**
3. Copy tabular data from the spreadsheet and **paste** it into the text area of the plugin's UI
4. Click on the **Update table** button
5. Select your table and reuse the plugin to update and resize it according to your given data
OR select a column with the same row amount to update the table cells.
If your table is an instance of a component, you can update it if it has the same row and column count.

## Development

This plugin was created using [Figma Plugin Boilerplate (FPB)](https://github.com/thomas-lowry/figma-plugin-boilerplate).

Use `npm run dev` to start watcher task or `npm run build` to create a production distribution.

## Possible improvements

- Enhancements
  - Support data that contains apostrophe characters
  - Support rows with alternating backgrounds (zebra)
  - Right align title cell when all cells below are right-aligned
  - Support Multi-line cells
  - Set all cells' text layers to auto layout `horizontal resizing` property to `Hug`
- Improvements
  - Error messages: Use UI with higher visibility than toast at the bottom of the screen
  - Auto-focus input field when plugin UI is opened (or/and add paste button)
  - Use CVS library for parsing data (might make parsing more robust)
  - Ignore hidden cells for updates
  - Improve GUI so that the button is labeled 'Update table' when updating tables (maybe also change dialog title)

## Credits

This plugin was inspired by [Sketch Table Builder](https://github.com/EricKramp/sketch-table-builder)
