import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';

// Use PostgreSQL's own shutdown protocol. Force-killing the Windows postmaster
// can leave background workers holding the TCP listening socket open.
export class LocalPostgres extends EmbeddedPostgres {
  shutdown;
  async stop() {
    if (this.shutdown) return this.shutdown;
    if (!this.process || this.process.exitCode !== null) { this.process = undefined; return; }
    this.shutdown = (async () => {
      const platform = process.platform === 'win32' ? 'windows' : process.platform;
      const { pg_ctl } = await import(`@embedded-postgres/${platform}-${process.arch}`);
      await new Promise((done, reject) => {
        const child = spawn(pg_ctl, ['-D', this.options.databaseDir, '-m', 'fast', '-w', '-t', '15', 'stop'], { windowsHide: true, stdio: 'ignore' });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? done() : reject(new Error(`PostgreSQL shutdown failed (${code})`)));
      });
      this.process = undefined;
    })();
    return this.shutdown;
  }
}
