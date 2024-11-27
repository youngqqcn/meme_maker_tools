# coding:utf8
# 批量生成 solana地址

import sys
from solders.keypair import Keypair  # type: ignore
from base58 import b58encode
import datetime


def get_current_time_formatted():
    now = datetime.datetime.now()
    formatted_time = now.strftime("%Y-%m-%d_%H-%M-%S")
    return formatted_time


def main():

    # 获取
    if len(sys.argv) != 2:
        print(
            "请输入地址数量, 地址数量范围:[1, 1000000], 示例: python generate_solana_address.py 100"
        )
        sys.exit(1)

    count = int(sys.argv[1])
    assert 0 < count and count <= 1000000, "地址数量不符合要求"

    # 新生成一个
    with open(f"批量地址_{get_current_time_formatted()}.csv", "w") as outfile:
        # print(f"{k.pubkey()},{k}")
        lines = []
        for i in range(0, count):
            k = Keypair()
            line = f"{k.pubkey()},{k}\n"
            lines.append(line)
        outfile.writelines(lines)

    pass


if __name__ == "__main__":
    main()
