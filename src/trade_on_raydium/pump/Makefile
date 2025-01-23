.PHONY: start stop

start:
	nohup ts-node pump_price.ts > pump_price.log 2>&1 &

stop:
	ps aux | grep pump_price | grep -v grep | awk '{print $$2}' | xargs kill

