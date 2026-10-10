---
sidebar_label: Document Export
sidebar_position: 35
---

# Document Export

The `@framers/agentos-ext-document-export` extension pack writes PDF, DOCX, PPTX, CSV and XLSX files from structured content. Its `createExtensionPack()` factory returns two tools: `document_export`, which renders and saves a file, and `document_suggest`, which says whether a reply is worth offering as a file.

## Installation

```bash
npm install @framers/agentos-ext-document-export
```

Load the pack through the extension manifest:

```typescript
import { AgentOS } from '@framers/agentos';

const agentos = await AgentOS.create({
  extensionManifest: {
    packs: [
      {
        package: '@framers/agentos-ext-document-export',
        options: {
          workspaceDir: '/home/agent/workspace',
          publicBaseUrl: 'https://agent.example.com',
        },
      },
    ],
  },
});
```

Or call the factory directly:

```typescript
import { createExtensionPack } from '@framers/agentos-ext-document-export';

const pack = createExtensionPack({
  options: {
    workspaceDir: '/home/agent/workspace',
    serverPort: 3777,
    publicBaseUrl: 'https://agent.example.com',
  },
  logger: console,
});

// pack.descriptors holds the document_export and document_suggest tools
```

## Extension Pack Options

```typescript
interface DocumentExportExtensionOptions {
  /** Priority used when registering the tools (default 50). */
  priority?: number;

  /** Workspace directory; files go to <workspaceDir>/exports (default process.cwd()). */
  workspaceDir?: string;

  /** Port written into download and preview URLs (default 3777). */
  serverPort?: number;

  /** Base URL written into download and preview URLs in place of http://localhost:<serverPort>. */
  publicBaseUrl?: string;
}
```

The pack writes files and builds URLs; it starts no HTTP server. A download URL is `<base>/exports/<filename>` and a preview URL is `<base>/exports/<filename>/preview`, where `<base>` is `publicBaseUrl` or `http://localhost:<serverPort>`. The host serves those paths, for example with `ExportFileManager.resolve()` and `PreviewGenerator` (below).

## Tools

### document_export

| Property | Value |
|----------|-------|
| **name** | `document_export` |
| **id** | `document-export-v1` |
| **category** | `productivity` |
| **hasSideEffects** | `true` |
| **requiredCapabilities** | `capability:document_export` |

Accepts [`DocumentExportInput`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/types.ts) and returns [`DocumentExportOutput`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/types.ts):

```typescript
interface DocumentExportInput {
  format: 'pdf' | 'docx' | 'pptx' | 'csv' | 'xlsx';
  content: DocumentContent;
  options?: ExportOptions;
}

interface DocumentExportOutput {
  filePath: string;      // Absolute path on disk
  downloadUrl: string;   // <base>/exports/<filename>
  previewUrl: string;    // <base>/exports/<filename>/preview
  format: string;
  sizeBytes: number;
  filename: string;      // Final filename with extension
}
```

The tool renders the file, saves it as `<workspaceDir>/exports/<timestamp>-<slug>.<format>` (the slug comes from `options.filename`, else the title) and returns the paths. A failed render returns `success: false` with `Document export failed: <reason>`.

The input schema the model sees lists the content fields `title`, `subtitle`, `author`, `date`, `theme` and `sections` (each with `heading`, `level`, `paragraphs`, `table`, `chart`, `list` and `keyValues`) and the options `filename`, `pageSize`, `orientation`, `coverPage` and `pageNumbers`. The generators also read a section's `image`, `speakerNotes` and `layout` and the `sheetName` option when a caller passes them.

### document_suggest

| Property | Value |
|----------|-------|
| **name** | `document_suggest` |
| **id** | `document-suggest-v1` |
| **category** | `productivity` |
| **hasSideEffects** | `false` |
| **requiredCapabilities** | `capability:document_suggest` |

```typescript
interface DocumentSuggestInput {
  responseText: string;
  wordCount: number;
  hasTableData: boolean;
  hasSections: boolean;
  isAnalytical: boolean;
}

interface DocumentSuggestOutput {
  shouldOffer: boolean;
  suggestedFormats: string[];
  offerText: string;
}
```

The tool reads the flags, not the text: more than 500 words suggests PDF and DOCX, table data CSV and XLSX, sections PPTX, and analytical content PDF and XLSX. `shouldOffer` is true when at least one format matches and `wordCount` is 200 or more; `offerText` is then `I can export this as <formats>. Want me to?`, with the matched formats upper-cased in the order of those rules: a 300-word analytical answer with table data gives `I can export this as CSV, XLSX, PDF. Want me to?`. When `shouldOffer` is false, `offerText` is an empty string and `suggestedFormats` still lists the matches.

## Formats

`document_export` sends each format to its own generator. The generator classes, the chart renderer and the theme table are internal: the package root does not export them.

### PDF

Built with `pdfkit`.

- Page size `letter` by default (`a4` and `legal` through `pageSize`), `portrait` or `landscape` through `orientation`
- A cover page with the title, subtitle, author and date unless `coverPage` is `false`
- The document title in the header of every content page, and page numbers in the footer unless `pageNumbers` is `false`
- Section headings at three levels
- Inline markdown in paragraphs: `**bold**`, `*italic*` and `[link](url)` as a clickable link
- Tables with a blue header row and striped rows, continued on the next page with the header repeated
- Charts as a titled table (see [Charts in PDF and DOCX](#charts-in-pdf-and-docx))
- Images from a URL (fetched with a 10-second timeout) or base64 data, with captions; an image that fails to load is skipped
- Bulleted and numbered lists
- Key-value pairs as a two-column Key and Value table

The PDF generator uses fixed colours and does not read `content.theme`.

### PPTX

Built with `pptxgenjs`, on the 16:9 wide layout.

- One slide per section that has content, after a cover slide unless `coverPage` is `false`
- The theme from `content.theme`: `dark`, `light`, `corporate`, `creative` or `minimal` (a missing or unknown name gives `light`), which sets the background, text, title and accent colours, the fonts and the chart palette
- Seven layouts, set by a section's `layout`: `title`, `content`, `two-column`, `image-left`, `image-right`, `chart-full` and `comparison`. Without one, a section with a chart gets `chart-full`, a section with an image and paragraphs gets `image-right`, and any other section gets `content`
- Native pptxgenjs charts: bar, line, pie, doughnut, area and scatter
- Speaker notes from a section's `speakerNotes`
- A slide number in the bottom-right corner
- Images from a URL (fetched with a 10-second timeout) or base64 data

`pageSize`, `orientation` and `pageNumbers` do not apply to slides.

### DOCX

Built with `docx`.

- A cover page with the title, subtitle, author and date, followed by a page break, unless `coverPage` is `false`
- The title in the header and `Page N` in the footer of every page
- Inline bold, italic and hyperlinks
- Table header rows in the theme's accent colour, with alternating row shading
- Charts as tables
- Images from a URL or base64 data, with captions
- Bulleted and numbered lists
- Key-value pairs as a borderless two-column table

The DOCX generator reads only the accent colour from `content.theme`, and does not read `pageSize`, `orientation` or `pageNumbers`.

### CSV

Each section's `table` and `keyValues` (as `Key` and `Value` columns) are written in order, with a blank row between blocks. Content with neither fails the export with `No tabular data found for CSV export. Try PDF or DOCX instead.`

### XLSX

Built with `exceljs`.

- One worksheet per `table` and one per `keyValues` block. The first worksheet takes `options.sheetName`; the others take the section heading, else `Sheet N`. Names have `\ / ? * [ ]` replaced with `_` and are cut to 31 characters
- A bold header row, white on a fixed blue (the theme is not read)
- A column whose cells all parse as numbers gets the number format `#,##0.##` and a bold `SUM` formula in a closing row, with `Total` in the first non-numeric column
- Column widths from the longest value plus two characters, capped at 60
- The first row frozen
- Content with no table or key-value data gives a single `Sheet 1` holding the title

### Charts in PDF and DOCX

PDF and DOCX render a [`ChartSpec`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/types.ts) as a table, after a line such as `Bar chart: Revenue — 2 datasets, 2 categories`:

- **bar / line / area**: the category column (named by `xAxisLabel`, else `Category`), one value column per dataset, and a `Visual` column of block characters scaled to the category total
- **pie / doughnut**: `Label`, `Value` and `Percentage` columns
- **scatter**: `Dataset`, `X` and `Y` columns

## ExportFileManager

Manages the exports directory. The tool uses one internally; a host uses its own to list, serve and delete files.

```typescript
import { ExportFileManager } from '@framers/agentos-ext-document-export';

const manager = new ExportFileManager('/home/agent/workspace', 3777, 'https://agent.example.com');

// Save a buffer to /home/agent/workspace/exports
const { filePath, filename } = await manager.save(buffer, 'Q4 Report', 'pdf');

// URLs
const downloadUrl = manager.getDownloadUrl(filename);
const previewUrl = manager.getPreviewUrl(filename);

// Absolute path of a saved file, or null (names with path separators are refused)
const path = manager.resolve(filename);

// List all exports
const files = await manager.list();
// [{ filename, format, sizeBytes, createdAt }]

// Delete an export; resolves to false when the file does not exist
const removed = await manager.remove(filename);
```

Files are stored as `{exportsDir}/{timestamp}-{slug}.{format}`, where the timestamp is the ISO time with `:` and `.` replaced by `-`.

## PreviewGenerator

Builds a preview of a saved file for a host to serve.

```typescript
import { PreviewGenerator } from '@framers/agentos-ext-document-export';

const preview = new PreviewGenerator();
const { contentType, body } = await preview.generatePreview('/home/agent/workspace/exports/data.csv', 'csv');
// contentType -> 'text/html'
// body -> '<!DOCTYPE html>...<table>...</table>...'
```

| Format | Preview type | Content |
|--------|-------------|---------|
| CSV | HTML table | The first 10 non-empty lines, the header line included |
| XLSX | HTML table | The first 10 rows of the first worksheet |
| PDF | Plain text | `PDF: <title>, <n> KB (<bytes> bytes)`; the title comes from a `/Title (...)` entry in the first 500 bytes, which files from this package do not have, so they show `Untitled` |
| DOCX | Plain text | Filename and file size |
| PPTX | Plain text | Filename and file size |

## Type Exports

All public types are re-exported from the package root:

```typescript
import type {
  ExportFormat,
  SlideTheme,
  ChartDataSet,
  ChartSpec,
  ImageSpec,
  TableData,
  DocumentSection,
  DocumentContent,
  ExportOptions,
  DocumentExportInput,
  DocumentExportOutput,
  DocumentSuggestInput,
  DocumentSuggestOutput,
} from '@framers/agentos-ext-document-export';
```

## Using the tool in an agency

A seat's `tools` map takes the tool instance from the pack:

```typescript
import { agency } from '@framers/agentos';
import { createExtensionPack } from '@framers/agentos-ext-document-export';

const pack = createExtensionPack({ options: { workspaceDir: './workspace' } });
const documentExport = pack.descriptors.find((d) => d.id === 'document_export')!.payload;

const team = agency({
  provider: 'openai',
  strategy: 'sequential',
  agents: {
    analyst: {
      instructions: 'Write a structured report with sections and a table of the figures.',
    },
    publisher: {
      instructions:
        'Export the report as a PDF with the document_export tool and reply with its download URL.',
      tools: { document_export: documentExport },
    },
  },
});

const result = await team.generate('Q4 revenue by region');
console.log(result.text);
```
