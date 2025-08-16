using Xunit;

// Disable parallel test execution to avoid multiple in-process WebApplicationFactory instances
// colliding and to eliminate intermittent file locking/race conditions during full runs.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
