import "tailwindcss/tailwind.css";
import { ToastContainer, Zoom } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Web3Provider } from "../helpers/Web3Context";
import { NetworkDisplay, DevUI } from "../components";

function MyApp({ Component, pageProps }) {
  return (
    <Web3Provider network="localhost">
      <>
        <NetworkDisplay />
        <DevUI />
        <Component {...pageProps} />
        <ToastContainer transition={Zoom} />
      </>
    </Web3Provider>
  );
}

export default MyApp;
