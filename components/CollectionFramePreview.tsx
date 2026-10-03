import Image from "@/components/DeploymentImage";
export default function CollectionFramePreview({ imagePath, name, size = "card", }: {
    imagePath: string;
    name: string;
    size?: "card" | "hub";
}) {
    const imageSize = size === "hub" ? "112px" : "104px";
    return (<div className="relative aspect-square w-full" aria-label={`${name} 미리보기`}>
      {imagePath ? (<Image src={imagePath} alt="" fill unoptimized sizes={imageSize} className="object-contain"/>) : null}
    </div>);
}
