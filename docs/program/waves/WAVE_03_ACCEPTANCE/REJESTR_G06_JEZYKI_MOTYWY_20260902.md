[stdin]:7
for(const k of kinds)for(const lang of ['pl','en'])for(const w of widths){const j=JSON.parse(fs.readFileSync(\`/private/tmp/cx-day280-jezyki-motywy-artefakty/R2-\${k}-\${lang}-\${w}.json\`));all.push(...j.wyniki.map(x=>({...x,lang,width:w})));pairs.push(...j.pary.map(x=>({...x,lang,width:w})));}
                                                                                                             ^
Unterminated template

SyntaxError: Invalid or unexpected token
    at makeContextifyScript (node:internal/vm:194:14)
    at compileScript (node:internal/process/execution:388:10)
    at evalTypeScript (node:internal/process/execution:260:22)
    at node:internal/main/eval_stdin:51:5
    at ReadStream.<anonymous> (node:internal/process/execution:205:5)
    at ReadStream.emit (node:events:508:28)
    at endReadableNT (node:internal/streams/readable:1701:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:89:21)

Node.js v24.12.0

