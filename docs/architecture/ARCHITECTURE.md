# Architecture

This document describes the high-level architecture of POSTING MAP.

# Data Foundation (Frozen)

The following architecture is the official baseline.

ADDRESS_SOURCE
↓
ADDRESS_MASTER
↓
__SYSTEM_CACHE__
↓
EventLog
↓
getAppData
↓
H-App

This layer is treated as the SSOT and must remain stable.

## Development Principles

- UI follows the Data Foundation.
- The Data Foundation must not be modified to satisfy UI requirements.
