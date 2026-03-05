const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/home/xg/stock-screener/mi_index_full.json'));
j.tables.forEach((t, i) => {
    if (i === 3 || i === 6) {
        console.log('--- Table', i, ':', t.title, '---');
        console.table(t.data);
    }
});
