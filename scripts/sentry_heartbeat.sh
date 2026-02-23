#!/bin/bash
set -euo pipefail

BASE="/Users/mac/.openclaw/workspace/xgvst"
LOG="$BASE/reports/lighthouse/p1.3-heartbeat.log"
RUNS_JSON="/Users/mac/.openclaw/subagents/runs.json"
SESS_JSON="/Users/mac/.openclaw/agents/main/sessions/sessions.json"

mkdir -p "$BASE/reports/lighthouse"

NOW_EPOCH="$(date +%s)"
NOW_HUMAN="$(date '+%Y-%m-%d %H:%M:%S')"

# main session 最近活动滞后秒数
MAIN_LAG_SEC="$(python3 - <<'PY'
import json, time
p='/Users/mac/.openclaw/agents/main/sessions/sessions.json'
try:
    data=json.load(open(p,'r',encoding='utf-8'))
    s=data.get('agent:main:main',{})
    updated=s.get('updatedAt')
    if not updated:
        print(-1)
    else:
        print(max(0,int(time.time()-updated/1000)))
except Exception:
    print(-1)
PY
)"

# 运行超300秒且未结束的subagent数量
STALE_SUBAGENTS="$(python3 - <<'PY'
import json, time
p='/Users/mac/.openclaw/subagents/runs.json'
now=time.time()
count=0
try:
    data=json.load(open(p,'r',encoding='utf-8'))
    runs=(data or {}).get('runs',{})
    for r in runs.values():
        started=r.get('startedAt')
        ended=r.get('endedAt')
        if started and not ended:
            if now-started/1000>300:
                count+=1
except Exception:
    pass
print(count)
PY
)"

# 最近30分钟 exec 失败数量（按主会话jsonl粗略统计）
RECENT_EXEC_FAILS="$(python3 - <<'PY'
import os, json, time, glob
base='/Users/mac/.openclaw/agents/main/sessions'
now=time.time()
cut=now-1800
cnt=0
for path in glob.glob(base+'/*.jsonl'):
    try:
        with open(path,'r',encoding='utf-8') as f:
            for line in f:
                try:
                    obj=json.loads(line)
                except Exception:
                    continue
                ts=obj.get('timestamp')
                if not ts:
                    continue
                t=ts/1000
                if t<cut:
                    continue
                text=line.lower()
                if 'exec failed' in text or 'exited with code 1' in text:
                    cnt+=1
    except Exception:
        pass
print(cnt)
PY
)"

printf "%s main_lag=%ss stale_subagents=%s recent_exec_fails=%s\n" \
  "$NOW_HUMAN" "$MAIN_LAG_SEC" "$STALE_SUBAGENTS" "$RECENT_EXEC_FAILS" >> "$LOG"

# 仅写告警标记，不做破坏性动作
if [[ "$MAIN_LAG_SEC" -gt 300 || "$STALE_SUBAGENTS" -gt 0 ]]; then
  printf "%s ALERT lag=%ss stale_subagents=%s\n" "$NOW_HUMAN" "$MAIN_LAG_SEC" "$STALE_SUBAGENTS" \
    >> "$BASE/reports/lighthouse/p1.3-heartbeat.alert.log"
fi

exit 0
