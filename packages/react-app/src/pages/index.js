import React, { useContext } from "react";
import { Account, Header, Auction } from "../components";
import { Web3Context } from "../helpers/Web3Context";

export default function home({ props }) {
  const web3 = useContext(Web3Context);

  return (
    <>
      {/* Page Header start */}
      <div className="flex flex-1 justify-between items-center">
        <Header />
        <div className="mr-6">
          <Account {...web3} />
        </div>
      </div>
      {/* Page Header end */}

      <div className="flex flex-1 flex-col items-center">
        <div className="text-center">
          <Auction
            name="GladsAuctionHouse"
            signer={web3.userSigner}
            provider={web3.localProvider}
            mainnetProvider={web3.mainnetProvider}
            kovanProvider={web3.kovanInfura}
            address={web3.address}
            blockExplorer={web3.blockExplorer}
            contractConfig={web3.contractConfig}
          />
        </div>
      </div>
    </>
  );
}
