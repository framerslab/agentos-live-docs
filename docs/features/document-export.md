---
title: "Document Export"
sidebar_position: 13.6
displayed_sidebar: guideSidebar
---

The `@framers/agentos-ext-document-export` extension generates professional documents from structured content. It follows the standard AgentOS extension pack pattern (`createExtensionPack()` factory) and provides two ITool implementations.

## Installation

Load via the extension system or import directly:

```typescript
import { AgentOS } from '@framers/agentos';

const agent = new AgentOS();
await agent.initialize({
  provider: 'openai',
  extensions: ['@framers/agentos-ext-document-export'],
});
```

Or use the factory directly:

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

// pack.descriptors contains document_export and document_suggest tools
```

## Extension Pack Options

```typescript
interface DocumentExportExtensionOptions {
  /** Override the default priority used when registering the tools. */
  priority?: number;

  /** Override the agent workspace directory (defaults to process.cwd()). */
  workspaceDir?: string;

  /** Override the server port used for download/preview URLs (defaults to 3777). */
  serverPort?: number;

  /** Override the externally reachable base URL used in export links. */
  publicBaseUrl?: string;
}
```

## Tools

### DocumentExportTool

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
  downloadUrl: string;   // HTTP download URL
  previewUrl: string;    // HTTP preview URL
  format: string;
  sizeBytes: number;
  filename: string;      // Final filename with extension
}
```

### DocumentSuggestTool

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

## Generator APIs

Each format has a dedicated stateless generator class. All generators accept [`DocumentContent`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/types.ts) and return a `Buffer`.

### PdfGenerator

```typescript
import { PdfGenerator } from '@framers/agentos-ext-document-export';

const pdf = new PdfGenerator();
const buffer = await pdf.generate(content, {
  pageSize: 'a4',
  orientation: 'portrait',
  coverPage: true,
  pageNumbers: true,
});

fs.writeFileSync('report.pdf', buffer);
```

**Features:**
- Cover page with centred title, subtitle, author, date
- Running headers (document title) and footers (page numbers)
- Section headings (H1/H2/H3) with proportional sizing
- Inline markdown: `**bold**`, `*italic*`, `[link](url)` with clickable hyperlinks
- Styled tables with accent-coloured headers, alternating row stripes, auto page-break with repeated headers
- Charts rendered as titled data tables via [`ChartRenderer`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/generators/ChartRenderer.ts)
- Remote image fetching with timeout and base64 data URI support
- Bulleted and numbered lists
- Key-value definition tables

### SlidesGenerator

```typescript
import { SlidesGenerator } from '@framers/agentos-ext-document-export';

const slides = new SlidesGenerator();
const buffer = await slides.generate(content, { coverPage: true });

fs.writeFileSync('presentation.pptx', buffer);
```

**Features:**
- 5 built-in themes (dark, light, corporate, creative, minimal)
- 7 slide layouts: title, content, two-column, image-left, image-right, chart-full, comparison
- Native chart rendering via pptxgenjs (bar, line, pie, doughnut, area, scatter)
- Auto-layout detection when no explicit layout hint is given
- Speaker notes per slide
- Slide numbers in bottom-right
- Embedded images with automatic URL fetching

### DocxGenerator

```typescript
import { DocxGenerator } from '@framers/agentos-ext-document-export';

const docx = new DocxGenerator();
const buffer = await docx.generate(content, { coverPage: true });

fs.writeFileSync('report.docx', buffer);
```

**Features:**
- Cover page with title, subtitle, author, date and page break
- Running headers and "Page N" footers
- Inline formatting: bold, italic, hyperlinks
- Themed table headers with alternating row shading
- Charts as formatted data tables
- Images from URL or base64 with captions
- Bullet and numbered lists
- Borderless key-value definition tables

### CsvGenerator

```typescript
import { CsvGenerator } from '@framers/agentos-ext-document-export';

const csv = new CsvGenerator();
const buffer = await csv.generate(content);

fs.writeFileSync('data.csv', buffer);
```

Scans sections for `table` and `keyValues` data. Multiple tables are separated by blank rows. Throws if no tabular data is found.

### XlsxGenerator

```typescript
import { XlsxGenerator } from '@framers/agentos-ext-document-export';

const xlsx = new XlsxGenerator();
const buffer = await xlsx.generate(content, { sheetName: 'Q4 Results' });

fs.writeFileSync('data.xlsx', buffer);
```

**Features:**
- Each table section becomes its own worksheet
- Bold, accent-coloured header rows
- Auto-detected numeric columns with number formatting
- SUM formula row appended to numeric columns
- Frozen first row for scrolling
- Auto-sized column widths (capped at 60 characters)
- Sheet names sanitised for Excel compatibility (31 char max, no illegal chars)

## ChartRenderer

Converts [`ChartSpec`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/types.ts) objects to tabular representations for PDF and DOCX embedding. Used internally by [`PdfGenerator`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/generators/PdfGenerator.ts) and [`DocxGenerator`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/productivity/document-export/src/generators/DocxGenerator.ts).

```typescript
import { ChartRenderer } from '@framers/agentos-ext-document-export';

const renderer = new ChartRenderer();
const { description, tableData } = renderer.renderChart({
  type: 'bar',
  title: 'Revenue',
  data: [
    { label: 'Q3', values: [4.2, 2.8], categories: ['NA', 'EU'] },
    { label: 'Q4', values: [5.1, 3.5], categories: ['NA', 'EU'] },
  ],
});

// description -> "Bar chart: Revenue -- 2 datasets, 2 categories"
// tableData -> { headers: ['Category', 'Q3', 'Q4', 'Visual'], rows: [...] }
```

Rendering strategies by chart type:
- **bar / line / area** -- Category column, dataset value columns, ASCII bar visualisation column
- **pie / doughnut** -- Label, Value, Percentage columns
- **scatter** -- Dataset, X, Y columns

## ExportFileManager

Manages the local exports directory for generated documents.

```typescript
import { ExportFileManager } from '@framers/agentos-ext-document-export';

const manager = new ExportFileManager('/home/agent/workspace', 3777, 'https://agent.example.com');

// Save a buffer
const { filePath, filename } = await manager.save(buffer, 'Q4 Report', 'pdf');

// URL generation
const downloadUrl = manager.getDownloadUrl(filename);
const previewUrl = manager.getPreviewUrl(filename);

// List all exports
const files = await manager.list();
// [{ filename, format, sizeBytes, createdAt }]

// Delete an export
await manager.remove(filename);
```

Files are stored as `{exportsDir}/{ISO-timestamp}-{slug}.{format}`.

## PreviewGenerator

Generates format-specific previews for serving via HTTP without downloading the full file.

```typescript
import { PreviewGenerator } from '@framers/agentos-ext-document-export';

const preview = new PreviewGenerator();
const { contentType, body } = await preview.generatePreview('/exports/data.csv', 'csv');
// contentType -> 'text/html'
// body -> '<html>...<table>...</table>...</html>' (first 10 rows)
```

| Format | Preview Type | Content |
|--------|-------------|---------|
| CSV | HTML table | First 10 rows with styled headers |
| XLSX | HTML table | First worksheet, first 10 rows |
| PDF | Plain text | Title extracted from metadata + file size |
| DOCX | Plain text | Filename + file size |
| PPTX | Plain text | Filename + file size |

## Themes

Five built-in themes available via `getTheme()`:

```typescript
import { getTheme, SLIDE_THEMES } from '@framers/agentos-ext-document-export';

const theme = getTheme('corporate');
// { name, background, textColor, titleColor, mutedColor, accentColor,
//   titleFont, bodyFont, chartPalette }

// All theme names
const names = Object.keys(SLIDE_THEMES);
// ['dark', 'light', 'corporate', 'creative', 'minimal']
```

Unknown theme names fall back to `'light'`.

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

## Integration with agency()

Use document export as the final step in a multi-agent research pipeline:

```typescript
import { agency } from '@framers/agentos';

const result = await agency({
  agents: {
    researcher: { role: 'research', tools: ['web_search', 'deep_research'] },
    analyst: { role: 'synthesize', tools: ['self_evaluate'] },
    publisher: { role: 'export', tools: ['document_export'] },
  },
  workflow: [
    { agent: 'researcher', task: 'Research {{topic}}' },
    { agent: 'analyst', task: 'Synthesize findings into structured report' },
    { agent: 'publisher', task: 'Export as PDF with corporate theme and cover page' },
  ],
});
```
