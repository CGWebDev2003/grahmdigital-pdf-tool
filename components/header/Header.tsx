import Image from "next/image";
import styles from "./header.module.css";

export default function Header() {
    return(
        <header className={styles.header}>
            <div className={styles.headerContent}>
                <a className={styles.logoLink} href="/">
                    <Image src={"/logo_white.png"} height={40} width={82} alt="Grahm Digital Logo" loading="eager" />
                    <h1 className={styles.logoText}>Brief Tool</h1>
                </a>
                <div className={styles.actionButtonBox}>
                    <button type="button" className={styles.csvButton}><i className="bi bi-file-earmark-arrow-up"></i> CSV hochladen</button>
                </div>
            </div>
        </header>
    );
}