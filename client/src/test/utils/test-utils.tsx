import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";

// Create a custom QueryClient for tests
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface ExtendedRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

// Wrapper component that provides all necessary providers
function Wrapper({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Custom render function that includes all providers
export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions }: ExtendedRenderOptions = {},
) {
  const Wrapper_ = ({ children }: { children: React.ReactNode }) => (
    <Wrapper queryClient={queryClient}>{children}</Wrapper>
  );

  return {
    ...render(ui, { wrapper: Wrapper_, ...renderOptions }),
    queryClient,
  };
}

// Re-export everything from React Testing Library
export * from "@testing-library/react";
export { userEvent };
export { default as userEventLib } from "@testing-library/user-event";
