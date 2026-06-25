declare module "react-dom" {
  import { ReactPortal, ReactNode } from "react";
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null): ReactPortal;
}
