# spl token的批量转账工具

- `cp m2m.csv.example m2m.csv`
- 填写 `data.csv`
  - `fromkey`: from地址私钥(base58格式)
  - `mint`: token mint
  - `address`: token接收地址
  - `amount`: 数量（浮点数），内部会乘以精度
  - `decimals：` 精度