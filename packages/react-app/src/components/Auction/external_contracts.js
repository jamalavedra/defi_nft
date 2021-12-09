const cDAIABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
];

// Kovan cDAI and cDAIx addresses
module.exports = {
  42: {
    contracts: {
      CErc20Delegator: {
        address: "0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD",
        abi: cDAIABI,
      },
      UUPSProxy: {
        address: "0x3ED99f859D586e043304ba80d8fAe201D4876D57",
        abi: cDAIABI,
      },
    },
  },
};
