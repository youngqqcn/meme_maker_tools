

https://docs.raydium.io/raydium/updates/archive/creating-an-openbook-amm-pool

- 同一个MarketID **只能使用一次**
- Token必须丢弃黑名单权限




-----

## Raydium AMM 关于LP Mint的数量计算公式

https://github.com/raydium-io/raydium-amm/blob/master/program/src/processor.rs#L1144-L1153

```rust
let liquidity = Calculator::to_u64(
    U128::from(amm_pc_vault.amount)
        .checked_mul(amm_coin_vault.amount.into())
        .unwrap()
        .integer_sqrt()  // 开根
        .as_u128(),
)?;
let user_lp_amount = liquidity
    .checked_sub((10u64).checked_pow(lp_mint.decimals.into()).unwrap())
    .ok_or(AmmError::InitLpAmountTooLess)?;
```

转为数学公式

- liquidity = int(sqrt( pc * coin ))
- lp_amount = (liquidity - 10 ^6)
- lp mint 的 decimals 为 6

示例:

如果提供  10_0000_0000 的base token(精度为6) ， 提供 1 SOL (精度为9)作为 quote token ，
那么

```python
liquidity = int(sqrt(10_0000_0000 *10**6  * 1 * 10**9))

user_lp_amount = (liquidity - 10**6)

精度为6, 因此是 user_lp_amount/10**6 = 999999

```

与devnet环境测试结果相同 https://explorer.solana.com/address/3GaoXhTzoJTFDeDeucyT8rTHxUrqtdBur9MUCVVp6wFq?cluster=devnet



## 创建Raydium池子 + 同时买入 捆绑交易

成功：
https://explorer.jito.wtf/bundle/37ad001fdac02ddfd542ab8a32e65a3f8b8c2c930d9a211ac2946bc05e39d94d