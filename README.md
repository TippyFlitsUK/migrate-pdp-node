# PDP Piece Migration Tool

Simple tool to migrate 5,224+ piece files from your current Filecoin PDP node to a new node with updated GA contracts.

## Quick Start

### 1. Install Dependencies

```bash
cd ~/migrate-pdp-node
npm install
```

### 2. Set Environment Variables

```bash
export PRIVATE_KEY="0x..."    # Your private key for target node
export PROVIDER_ID="123"       # Your provider ID on target node
```

### 3. Check Balance & Deposit USDFC

**Important**: You must deposit USDFC into the Payments contract before migrating.

```bash
# Check your balances
npm run balance

# Deposit USDFC (e.g., 50 USDFC)
npm run deposit 50
```

### 4. Run Migration

```bash
npm run migrate
```

Or directly with tsx:

```bash
tsx migrate.ts
```

## Configuration

All configuration via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | ✓ | - | Private key for signing transactions (with 0x prefix) |
| `PROVIDER_ID` | ✓ | - | Target provider ID |
| `RPC_URL` | | Calibration | Blockchain RPC endpoint |
| `SOURCE_PATH` | | `/filecoin-storage/piece` | Source directory with pieces |
| `CONCURRENCY` | | `20` | Number of parallel uploads |
| `LOG_INTERVAL` | | `50` | Progress log every N pieces |

## Examples

### Basic Migration
```bash
export PRIVATE_KEY="0xabc..."
export PROVIDER_ID="456"
npm run migrate
```

### High Performance (50 parallel uploads)
```bash
export CONCURRENCY=50
npm run migrate
```

### Conservative (5 parallel uploads, safer if rate limited)
```bash
export CONCURRENCY=5
npm run migrate
```

### Different Source Directory
```bash
export SOURCE_PATH="/mnt/backup/pieces"
npm run migrate
```

## Expected Output

```
🚀 Filecoin PDP Piece Migration Tool

Configuration:
  Source: /filecoin-storage/piece
  RPC URL: https://api.calibration.node.glif.io/rpc/v1
  Provider ID: 123
  Concurrency: 20

Initializing Synapse SDK...
✓ SDK initialized

Creating storage context...
✓ Storage context created

Scanning piece files...
✓ Found 5224 piece files

Starting migration...

Progress: 50/5224 (1.0%) | Rate: 12.5/s | ETA: 6m 54s
Progress: 100/5224 (1.9%) | Rate: 13.2/s | ETA: 6m 28s
...

============================================================
Migration Complete
============================================================
Total files: 5224
Succeeded: 5220 (99.9%)
Failed: 4 (0.1%)
Duration: 8m 42s
Throughput: 10.0 pieces/sec

⚠ Error log saved to: migration-errors.json

✓ Migration finished!
```

## Handling Failures

If some pieces fail:

1. **Check error log**: `migration-errors.json`
2. **Review errors**: Network issues vs. file corruption
3. **Retry**: Re-run the script (already uploaded pieces will be handled by the provider)

## Performance Tuning

### Estimated Duration

Based on 5,224 pieces (65GB):

| Concurrency | Network Speed | Duration |
|-------------|---------------|----------|
| 5 | Slow | 2-3 hours |
| 10 | Medium | 1-2 hours |
| 20 | Fast | 45-90 min |
| 50 | Very Fast | 20-40 min |

### Optimization Tips

**Slow network or timeouts?**
- Reduce `CONCURRENCY` to 5-10

**Fast network?**
- Increase `CONCURRENCY` to 30-50

**Rate limiting errors?**
- Lower `CONCURRENCY`
- Contact provider for rate limit increase

## How It Works

1. **Scans** `/filecoin-storage/piece/` for all files starting with `s-t00-`
2. **Creates** a single storage context (dataset) on the target node
3. **Uploads** all pieces in parallel batches
4. **Tracks** progress with real-time ETA and throughput
5. **Logs** any failures to `migration-errors.json`

## Troubleshooting

### "PRIVATE_KEY environment variable is required"
```bash
export PRIVATE_KEY="0x1234..."
```

### "PROVIDER_ID environment variable is required"
```bash
export PROVIDER_ID="123"
```

### "Cannot find module '@filoz/synapse-sdk'"

Try reinstalling dependencies:
```bash
cd ~/migrate-pdp-node
rm -rf node_modules package-lock.json
npm install
```

### "No piece files found"

Check that the source path is correct:
```bash
ls /filecoin-storage/piece/s-t00-* | head -5
```

## Post-Migration Verification

1. **Check piece count on target node**:
   ```bash
   PGPASSWORD=yugabyte psql -h TARGET_HOST -p 5433 -U yugabyte -d yugabyte \
     -c "SELECT COUNT(*) FROM curio.pdp_data_set_pieces"
   ```

2. **Monitor PDP proofs**:
   ```bash
   PGPASSWORD=yugabyte psql -h TARGET_HOST -p 5433 -U yugabyte -d yugabyte \
     -c "SELECT * FROM curio.pdp_prove_tasks ORDER BY id DESC LIMIT 10"
   ```

3. **Check payment rail balance** - Ensure sufficient USDFC

4. **Test sample retrievals** via Curio API or synapse-sdk

## Safety Notes

- **Source files are NOT deleted** - originals remain intact
- **Script is idempotent** - safe to re-run if interrupted
- **Errors are logged** - review `migration-errors.json`
- **Progress is continuous** - no checkpointing needed

## Architecture

- **TypeScript** with ES modules
- **synapse-sdk** for Filecoin interactions
- **p-limit** for concurrency control
- **tsx** for TypeScript execution

## Files

```
~/migrate-pdp-node/
├── package.json       # Dependencies and scripts
├── migrate.ts         # Main migration script
├── tsconfig.json      # TypeScript configuration
├── .env.example       # Environment variable template
└── README.md          # This file
```

## Need Help?

- Review error log: `migration-errors.json`
- Check Curio logs on target node: `/var/log/curio/`
- Check synapse-sdk docs: https://github.com/FilOzone/synapse-sdk
