# Custom Utility

The browser-based Custom Utility is served by the main Express app at
`/custom-tools.html`. The site root (`/`) is the application picker for
nandoApp and Custom Utility.

## Browser tools

- Attendance summaries accept `.xls` and `.xlsx` reports.
- PDF merging by employee ID groups and orders files using the configured
  keywords.
- PDF merging by All supports drag-and-drop and keyboard-accessible ordering.
- PDF-to-Word extracts selectable text into `.docx`. It does not preserve PDF
  page layout, tables, or images.
- QR Code and Code 128 generation downloads a PNG.

File contents are processed in browser memory. The browser version does not
send selected files to the Express API or write them to a database or server
disk. The original Python desktop and Streamlit applications remain in this
folder; running those separately uses their existing Python execution model.

## Build and test

From `NandoApp-backend`:

```sh
npm run build:custom-tools
npm test
npm start
```

The build writes `public/custom-tools.html` and its bundled, self-hosted assets
to `public/custom-tools-assets`. Include those generated public files when
deploying the app.
