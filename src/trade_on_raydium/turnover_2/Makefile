.PHONY: start stop

start:
	nohup ts-node turnover2.ts > turnover2.log 2>&1 &

stop:
	ps aux | grep turnover2 | grep -v grep | awk '{print $$2}' | xargs kill

