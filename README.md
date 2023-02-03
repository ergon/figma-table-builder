# Table Builder

_Table Builder_ lets you paste tabular data and generates tables from a single component.

For each entry in the spread sheet, _Table Builder_ creates an instance of your original cell component, positions it in a grid and updates the cell's first child of type `text` with the data entry from the spreadsheet (Excel, Numbers, etc).

## Demo

[https://www.youtube.com/watch?v=Y4QhE9EZ4pY]

## Usage

1. Create a component that contains a text label
2. Select an **instance** of that component
3. In the plugins menu, open **Table Builder**
4. Copy tabular data from the spreadsheet and **paste** it into the text area of the plugin's UI
5. Click on the **Build Table** button

## Development

This plugin was created using [Figma Plugin Boilerplate (FPB)](https://github.com/thomas-lowry/figma-plugin-boilerplate).

Use `npm run dev` to start watcher task or `npm run build` to create a production distribution.

## Possible improvements

- Support table cell components having their text label **not** as a direct child
- Error messages: Use UI with higher visibility than toast at the bottom of the screen
- Auto-focus input field when plugin UI is opened (or/and add paste button)

## Credits

This plugin was inspired by [Sketch Table Builder](https://github.com/EricKramp/sketch-table-builder)
