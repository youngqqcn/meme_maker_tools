.PHONY: start stop

start:
	nohup ts-node pump_price2.ts > pump_price2.log 2>&1 &

stop:
	ps aux | grep pump_price2 | grep -v grep | awk '{print $$2}' | xargs kill

