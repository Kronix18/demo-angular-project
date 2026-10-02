"""Marks a task done: python3 scripts/task-done.py <id> "<verification notes, use \\n for bullets>" [STATUS]
Updates the task file (Status line + 'Verification results') and the row in TASKS/README.md."""
import sys,glob,re,os
tid=sys.argv[1]; note=sys.argv[2]; status=sys.argv[3] if len(sys.argv)>3 else 'DONE'
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','TASKS')
f=glob.glob(f'{R}/phase-*/{tid}-*.md')[0]
s=open(f).read()
s=re.sub(r'^Status: .*$',f'Status: {status}',s,count=1,flags=re.M)
s=s.replace('- (pending)','- '+note.replace('\\n','\n- '))
open(f,'w').write(s)
rp=f'{R}/README.md'
r=open(rp).read()
lines=r.split('\n')
for i,l in enumerate(lines):
    if l.startswith(f'| {tid} |'):
        parts=l.split('|')
        parts[3]=f' {status} '
        lines[i]='|'.join(parts)
        break
else: raise SystemExit('row not found')
open(rp,'w').write('\n'.join(lines))
print('ok',f)
