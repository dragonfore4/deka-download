# DEKA Ptoey (ฎีกา ผู้ต่อ)

A robust tool to download Thai court documents (DEKA/ฎีกา) from the Supreme Court of Thailand as PDFs.

## Features

- ⚡ **High Performance**: Concurrent downloads with configurable concurrency limits
- 🛡️ **Reliable**: Automatic retries with exponential backoff, checkpoint/resume capability
- 📝 **Logging**: Comprehensive logging to both console and file
- 🔧 **Configurable**: Centralized configuration for easy customization
- 🔄 **Resume Support**: Automatically resume interrupted downloads
- 📊 **Progress Tracking**: Real-time progress reporting

## Prerequisites

- [Bun](https://bun.sh/) (JavaScript runtime)
- [Docker](https://www.docker.com/) (for Gotenberg PDF conversion service)

## Installation

```bash
bun install
```

## Setup

Before running the PDF workflow, start Gotenberg (the HTML→PDF service).

### Recommended: docker compose (includes Thai fonts)

The DEKA print pages use the Windows fonts *Browallia New* / *Angsana New*, which
don't exist on Linux. The bundled `Dockerfile.gotenberg` installs the TLWG Thai
fonts and aliases those names (see `fonts/local.conf`) so Thai text renders
correctly instead of as missing-glyph boxes.

```bash
docker compose up -d --build   # build + run in the background on port 3000
docker compose logs -f         # watch logs
docker compose down            # stop
```

### Quick alternative (no custom Thai fonts)

```bash
docker run --rm -p 3000:3000 gotenberg/gotenberg:8
```

If Gotenberg is not on `http://127.0.0.1:3000`, set the `GOTENBERG_URL` environment variable:

```bash
export GOTENBERG_URL=http://your-gotenberg-url:port
```

## Usage

### Main Workflow

Run the main workflow to download documents for predefined year ranges:

```bash
bun run start
```

Or using the development script:

```bash
bun run dev
```

### Split-by-Year Workflow

Run the split-by-year workflow (includes document count in folder name):

```bash
bun run start:split
```

### Testing

Test the PDF download functionality:

```bash
bun run test
```

### Cleaning Up

Remove downloaded files, checkpoints, and logs:

```bash
bun run clean
```

## Configuration

The application can be configured through environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GOTENBERG_URL` | `http://127.0.0.1:3000` | Gotenberg service URL |
| `GET_DEKA_ID_CONCURRENCY_LIMIT` | `5` | Number of concurrent page fetches |
| `DOWNLOAD_CONCURRENCY_LIMIT` | `5` | Number of concurrent PDF downloads |

Additional configuration options can be found in `config.ts`.

## How It Works

1. **Get Total Pages**: Determine the total number of pages for the specified year range
2. **Fetch Document IDs**: Concurrently fetch all document IDs from search result pages
3. **Download PDFs**: Download PDFs with concurrent batching and automatic retries
4. **Checkpoint/Resume**: Save progress and resume interrupted downloads

## Output

- PDF files are saved to the `downloads/` directory
- Logs are written to `deka_download.log`
- Progress checkpoints are saved to `.download_checkpoint.json`

## License

MIT
