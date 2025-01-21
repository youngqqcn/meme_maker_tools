turnover:
	nohup ts-node turnover.ts > turnover.log 2>&1 &

stop:
	ps aux | grep turnover | grep -v grep | awk '{print $2}' | xargs kill