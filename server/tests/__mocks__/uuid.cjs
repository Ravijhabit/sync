// CJS shim for uuid v14 (pure ESM) so Jest can import it in CommonJS mode.
// crypto.randomUUID() produces valid RFC-4122 v4 UUIDs, identical to uuid's v4().
const crypto = require('crypto');
module.exports = {
  v4: () => crypto.randomUUID(),
};
