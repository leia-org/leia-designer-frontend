import { Box, Skeleton, Stack } from "@mui/material";

type LeiaListSkeletonProps = {
  count?: number;
};

export const LeiaListSkeleton = ({ count = 4 }: LeiaListSkeletonProps) => (
  <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
    {Array.from({ length: count }).map((_, index) => (
      <Box
        component="li"
        key={`leia-skeleton-${index}`}
        sx={{ py: 2, borderBottom: index < count - 1 ? "1px solid" : 0, borderColor: "divider" }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Skeleton variant="circular" width={78} height={78} />
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Skeleton variant="text" width={180} height={22} />
              <Skeleton variant="rounded" width={52} height={22} />
            </Stack>
            <Skeleton variant="text" height={18} sx={{ width: "90%", mb: 0.5 }} />
            <Skeleton variant="text" height={18} sx={{ width: "70%" }} />
          </Box>
        </Stack>
      </Box>
    ))}
  </Box>
);