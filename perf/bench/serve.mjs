import {startProdServer} from '../../node_modules/vinext/dist/server/prod-server.js';
await startProdServer({port:Number(process.argv[2]||3100),host:'127.0.0.1',outDir:process.argv[3]||'dist'});
