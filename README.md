# Glad betting

# 🔭 How it works

The proceeds of daily auctions are sent to the treasury. That's when the DeFi Glad magic starts:

- The ETH from the winning bid is swapped on Uniswap for DAI. The resulting DAI is then deposited in Compound Finance, and begins to earn yield
- A portion of the Compound tokens (cDAI) representing the deposits are then upgraded to "Super Tokens" in the Superfluid protocol.
- Then Super Tokens begin streaming -- every second -- back to Glad owners:
- 10% of of the proceeds of the auction stream back to the Glad Owner over the next 365 days. If the Glad is sold or transfered, the stream switches to the new owner.
- 40% of the proceeds of each auction are shared by all current Glad owners and streamed to each of them over the next 365 days.
- 20% of the proceeds for each auction go to the owner of the 10th Glad before this one. For example, 20% of the proceeds of the auction for Glad 10 will get streamed to the owner of Glad 0, over the next 365 days.
- In future, the Club may decide to change the DeFi investments and distributions in interesting ways.

Of course, Glads are ERC721 NFTs that can be used as Avatars and traded on OpenSea or other marketplaces. Glads Club is an experiment fusing NFTs with incentived tokenomics to foster community.

# 🛠 How it's build

Glads is composed of two smart contracts and a front-end dapp that manages periodic NFT minting and auctioning Glads to the highest bidder.

The auction house contract is a modified version of the Zora Auction House contract. While the idea is for auctions to last 24 hours, minting one Glad each day, it is currently set to 10 minutes for development and demo purposes. Once the contract is deployed and initialized, it calls the ERC721 contract to mint a new Glad. At this point the Glad is not transferred to the Auction House but is held by the ERC721 contract pending the outcome of the auction. When the auction is over, a transaction to settle the auction triggers the transfer of the Glad to the winner and the transfer of the ETH proceeds to the ERC721 contract, which also acts as a treasury. That's when the DeFi starts...

The Glad contract leverages OpenZeppelin contracts to provide standard ERC721 functions, but also doubles as a treasury that not only holds funds, but invests them in DeFi and streams the result back NFT holders via Superfluid Finance. When an is won, the Glad contract transfers the Glad to the winner and receives the ETH proceeds. Immediately, the following is triggered:

- The Glad contract calls the Chainlink price feed oracle for ETH/DAI to get the latest price for DAI.
- Using the Chainlink data to set a reasonable slippage margin, the ETH is then swapped for DAI using Uniswap v3.
- The DAI is then immediately deposited in Compound Finance, where is starts to earn yield and COMP token rewards for the treasury. The contract now holds cDAI tokens representing the deposited DAI.
- A subset of the cDAI is then "upgraded" to cDAIx via the Superfluid protocol.
- Multiple streams of cDAIx being streaming -- every second -- back to the auction winner, and also to other Glad owners, according the following formula: 10% of auction proceeds stream back to the holder of that NFT over 365 days, PLUS 40% of the proceeds are divided among all Glad owners at the time, and streamed to them over 365 days, PLUS 20% of the proceeds are streamed to owner of the 10th glad prior, over 365 days (proceeds from Glad 10 stream to the owner of Glad 0, proceeds from Glad 11 stream to Glad 1, etc.)
- After 365 days, anyone can act as a "closer", and send a transaction to close the streams that are eligible. An instant (not streamed) reward equivalent to 30 days of flow is earned.
- When a Glad is sold or transferred, the streams are redirected automatically to the new owner.

The dapp primarily interfaces with the Auction House contract. User can connect their wallet, submit bids and settle auctions, which triggers the minting of a new Glad and starts a new auction. The dapp also displays the cDAI balances of the treasury and connected user, showing the real-time changes as funds are streamed out of the treasury to Glad owners.

To display bid history for each auction, I used the Covalent API with their "primer" filters to fetch only the specific "new bid" events from the Auction House contract, along with date stamps for each. This made is very easy to display this information on the frontend.
