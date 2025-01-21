Raydium狙击升级版



第一版狙击工具的实战效果:
- 5.03 SOL那笔交易是我的，与第一笔交易相差了7个区块(2.8s ~ 4.2s)

![](../../../imgs/CAMI_snipers.jpg)


- 加池子(314302362): https://solscan.io/tx/X6SL5FAzu7cMcRDF1BrgrMuzaDF1m1WTfLA5vbSzNj6pZJrLC7v3bvTFzw8JrAUUuxgWxxJUwgWpEVe8pSUJDcy
- 买入(314302362): https://solscan.io/tx/431Ggyrfn9AwafyMtKV8cDvD4xTdi7gAWTw3bA28e2awPqqB6ocdKCyBr99DS85zYT5Zumt2Xv8gQLBds8c1WzNY
- 买入(314302363) https://solscan.io/tx/2tncYxDj86LmbXEqanD1QSPNNHvnYyqQ8xc6hGKqFMkjXsuKStQ7B7btvTyTCSmt5VEhyAMqQkVV7caiw3SEtpVs
- 卖出(314302363): https://solscan.io/tx/3bf2gybA2XxEk1GGJTZAcysZQDDauCj4rwtvBsLysyJRJz67p6z6r34dm2r1tPjz8CYGBmMYZSUtcZjgX96XMTUi
- 买入(314302364): https://solscan.io/tx/4z5qgbnYLX12s3LXHWza9QNP4o5ErZqKwiPQFFQoJuMfEJfdbFHncxnfRGXqpzzEix5QoUJ8izmdsxsuRbT9Wkvy
- ...
- 我的买入(314302369): https://solscan.io/tx/4iF7YhcKpjFpUBrNrWVEHeLKkvY291n61YzBnLwjVUjve1WP1AphdsrA6U5gGvyM1b2e6XrTwN2ib9bUXCbTKdsn






升级狙击工具



- 交易发送服务
  - Jito:
  - NextBlock 交易发送服务：
    -  https://docs.nextblock.io/
      -  API: https://docs.nextblock.io/api/submit-transaction
         - 参考： https://github.com/whistledev411/pumpfun-sniper/blob/master/src/pumputils/utils/buyToken.ts

- Shyft RPC:
  -  https://docs.shyft.to/solana-rpcs-das-api/shyft-rpcs



- Geyser RPC:
  - 

## 参考代码

- 监听账户更新[禁止直接使用代码，防止后门]: https://github.com/cutupdev/Solana-Raydium-Sniper-Bot/blob/main/start.ts#L458
- 监听Raydium交易:  https://github.com/web3batman/Solana_Memecoin_Sniper_Bot/blob/main/solana-bot-BE/track/raydium/raydium.ts#L793




