import sys
import os

def fix_focus():
    path = os.path.expanduser('~/stock-screener/client/src/components/MarketFocus.jsx')
    if not os.path.exists(path): return
    content = open(path).read()
    old = '''<span
                        className={\	ext-[12px] font-bold text-gray-700 whitespace-nowrap group-hover:text-brand-primary \}
                        style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '-1px' }}
                    >
                        {stock.name}
                    </span>'''
    new = '''<span
                        className={\	ext-[11px] font-bold text-gray-700 whitespace-nowrap group-hover:text-brand-primary \}
                        style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '-1.5px', maxHeight: '80px', overflow: 'hidden' }}
                        title={stock.name}
                    >
                        {stock.name.length > 5 ? stock.name.substring(0, 5) + '...' : stock.name}
                    </span>'''
    if old in content:
        open(path, 'w').write(content.replace(old, new))
        print('Fixed MarketFocus.jsx')
    else:
        print('Could not find target in MarketFocus.jsx')

def fix_dashboard():
    path = os.path.expanduser('~/stock-screener/client/src/components/MarketDashboard.jsx')
    if not os.path.exists(path): return
    content = open(path).read()
    old = 'if (loading) {'
    new = 'if (loading || (!data?.twseVolume?.length && !data?.tpexVolume?.length)) {'
    if old in content:
        open(path, 'w').write(content.replace(old, new))
        print('Fixed MarketDashboard.jsx')
    else:
        print('Could not find target in MarketDashboard.jsx')

if __name__ == '__main__':
    fix_focus()
    fix_dashboard()
