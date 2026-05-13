const fs = require('fs');
const sourceMap = require('source-map');

const mapFile = 'dist/assets/Inventory-ltnugKyu.js.map';
const line = 2;
const column = 1064;

async function mapError() {
    const rawSourceMap = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    await sourceMap.SourceMapConsumer.with(rawSourceMap, null, consumer => {
        const pos = consumer.originalPositionFor({
            line: line,
            column: column
        });

        console.log('Original Position:', pos);
        if (pos.source) {
            const content = consumer.sourceContentFor(pos.source);
            if (content) {
                const lines = content.split('\n');
                console.log('Context (Original):');
                for (let i = Math.max(0, pos.line - 5); i < Math.min(lines.length, pos.line + 5); i++) {
                    console.log(`${i + 1}: ${lines[i]}`);
                }
            }
        }
    });
}

mapError().catch(err => console.error(err));
