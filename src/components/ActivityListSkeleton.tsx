import { Box, Paper, Skeleton, Stack } from "@mui/material";

type ActivityListSkeletonProps = {
	count?: number;
};

export const ActivityListSkeleton = ({ count = 4 }: ActivityListSkeletonProps) => (
	<Stack spacing={1.5}>
		{Array.from({ length: count }).map((_, index) => (
			<Paper key={`activity-skeleton-${index}`} variant="outlined" sx={{ overflow: "hidden" }}>
				<Stack
					direction={{ xs: "column", md: "row" }}
					justifyContent="space-between"
					alignItems={{ md: "flex-start" }}
					spacing={2}
					sx={{ p: 2.5 }}
				>
					<Box sx={{ flex: 1 }}>
						<Skeleton variant="text" width="42%" height={32} />
						<Stack direction="row" spacing={2} sx={{ mt: 0.75 }}>
							<Skeleton variant="text" width={150} height={20} />
							<Skeleton variant="text" width={72} height={20} />
						</Stack>
					</Box>
					<Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
						<Skeleton variant="rounded" width={78} height={32} />
						<Skeleton variant="rounded" width={82} height={32} />
					</Stack>
				</Stack>
			</Paper>
		))}
	</Stack>
);
