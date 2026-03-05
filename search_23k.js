const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/home/xg/stock-screener/mi_index_full.json'));
j.tables.forEach((t, i) => {
    t.data.forEach((row, ri) => {
        row.forEach((cell, ci) => {
            if (typeof cell === 'string') {
                const val = parseFloat(cell.replace(/,/g, ''));
                if (val > 20000 && val < 27000) {
                    console.log('Match in Table', i, '(', t.title, '), Row', ri, 'Col', ci, ':', cell);
                }
            }
        });
    });
});
