/* eslint-disable */
// @ts-nocheck

import global from 'global';

import React, { ComponentType, useLayoutEffect, useRef } from 'react';
import ReactDOM, { version as reactDomVersion } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { AnyFramework } from '@storybook/csf';
import { Story } from '@storybook/store';

import { DocsContextProps } from './types';
import { NoDocs } from './NoDocs';

export function renderDocs<TFramework extends AnyFramework>(
  story: Story<TFramework>,
  docsContext: DocsContextProps<TFramework>,
  element: HTMLElement,
  callback: () => void
) {
  return renderDocsAsync(story, docsContext, element).then(callback);
}

const elementRoots = new WeakMap<HTMLElement, any>();

const { FRAMEWORK_OPTIONS } = global;
const canUseNewReactRootApi =
  reactDomVersion && (reactDomVersion.startsWith('18') || reactDomVersion.startsWith('0.0.0'));
const shouldUseNewRootApi = FRAMEWORK_OPTIONS?.legacyRootApi !== true;
const isUsingNewReactRootApi = shouldUseNewRootApi && canUseNewReactRootApi;

const WithCallback: FC<{ callback: () => void; children: ReactElement }> = ({
  callback,
  children,
}) => {
  // See https://github.com/reactwg/react-18/discussions/5#discussioncomment-2276079
  const once = useRef<() => void>();
  useLayoutEffect(() => {
    if (once.current === callback) return;
    once.current = callback;
    callback();
  }, [callback]);

  return children;
};

async function renderDocsAsync<TFramework extends AnyFramework>(
  story: Story<TFramework>,
  docsContext: DocsContextProps<TFramework>,
  element: HTMLElement
) {
  const { docs } = story.parameters;
  if ((docs?.getPage || docs?.page) && !(docs?.getContainer || docs?.container)) {
    throw new Error('No `docs.container` set, did you run `addon-docs/preset`?');
  }

  const DocsContainer: ComponentType<{ context: DocsContextProps<TFramework> }> =
    docs.container ||
    (await docs.getContainer?.()) ||
    (({ children }: { children: Element }) => <>{children}</>);

  const Page: ComponentType = docs.page || (await docs.getPage?.()) || NoDocs;

  // Use `componentId` as a key so that we force a re-render every time
  // we switch components
  const docsElement = (
    <DocsContainer key={story.componentId} context={docsContext}>
      <Page />
    </DocsContainer>
  );

  await new Promise<void>((resolve) => {
    if (isUsingNewReactRootApi) {
      let root = elementRoots.get(element);
      if (!root) {
        root = createRoot(element);
        elementRoots.set(element, root);
      }
      root.render(<WithCallback callback={() => resolve(null)}>{docsElement}</WithCallback>);
    } else {
      ReactDOM.render(docsElement, element, resolve);
    }
  });
}

export function unmountDocs(element: HTMLElement) {
  if (isUsingNewReactRootApi) {
    const root = elementRoots.get(element);
    if (root) {
      root.unmount();
      elementRoots.delete(element);
    }
  } else {
    ReactDOM.unmountComponentAtNode(element);
  }
}
